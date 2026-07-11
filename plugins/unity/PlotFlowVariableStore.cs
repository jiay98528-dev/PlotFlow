// ============================================================================
// PlotFlow Unity Runtime — scope-aware variable state
//
// Keeps global and per-chapter namespaces separate while preserving the flat
// Dictionary API exposed by the 0.1 reader.
// ============================================================================

using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;

namespace PlotFlow
{
    public sealed class PlotFlowVariableStore
    {
        private readonly Dictionary<string, VariableDeclaration> _definitions;
        private readonly Dictionary<string, object> _globalValues = new Dictionary<string, object>();
        private readonly Dictionary<string, Dictionary<string, object>> _chapterValues =
            new Dictionary<string, Dictionary<string, object>>();

        public string CurrentChapterId { get; private set; }

        public PlotFlowVariableStore(
            Dictionary<string, VariableDeclaration> definitions,
            string currentChapterId = null)
        {
            _definitions = definitions ?? new Dictionary<string, VariableDeclaration>();
            foreach (var entry in _definitions)
            {
                if (!IsChapterScoped(entry.Value))
                    _globalValues[entry.Key] = ResolveDefaultValue(entry.Value);
            }
            SetCurrentChapter(currentChapterId ?? string.Empty);
        }

        public void SetCurrentChapter(string chapterId)
        {
            CurrentChapterId = chapterId ?? string.Empty;
            EnsureChapter(CurrentChapterId);
        }

        public object Get(string name, object defaultValue = null)
        {
            if (string.IsNullOrEmpty(name))
                return defaultValue;

            if (!CanAccess(name))
                return defaultValue;

            if (_definitions.TryGetValue(name, out var definition) && IsChapterScoped(definition))
            {
                var chapter = EnsureChapter(CurrentChapterId);
                return chapter.TryGetValue(name, out var scopedValue) ? scopedValue : defaultValue;
            }

            var currentChapter = EnsureChapter(CurrentChapterId);
            if (currentChapter.TryGetValue(name, out var chapterOverride))
                return chapterOverride;

            return _globalValues.TryGetValue(name, out var globalValue) ? globalValue : defaultValue;
        }

        public bool TryGetValue(string name, out object value)
        {
            value = Get(name);
            return value != null || Contains(name);
        }

        public bool Contains(string name)
        {
            if (!CanAccess(name))
                return false;
            if (_definitions.TryGetValue(name, out var definition) && IsChapterScoped(definition))
                return EnsureChapter(CurrentChapterId).ContainsKey(name);
            return EnsureChapter(CurrentChapterId).ContainsKey(name) || _globalValues.ContainsKey(name);
        }

        public void Set(string name, object value)
        {
            TrySet(name, value);
        }

        public bool TrySet(string name, object value)
        {
            if (!CanAccess(name))
                return false;
            if (_definitions.TryGetValue(name, out var definition) && IsChapterScoped(definition))
                SetChapter(name, value);
            else
                SetGlobal(name, value);
            return true;
        }

        public void SetGlobal(string name, object value)
        {
            if (!string.IsNullOrEmpty(name))
                _globalValues[name] = NormalizeJsonValue(value);
        }

        public void SetChapter(string name, object value, string chapterId = null)
        {
            if (string.IsNullOrEmpty(name))
                return;
            var resolvedChapter = chapterId ?? CurrentChapterId;
            if (!CanAccess(name, resolvedChapter))
                return;
            EnsureChapter(resolvedChapter)[name] = NormalizeJsonValue(value);
        }

        public bool CanAccess(string name, string chapterId = null)
        {
            if (!_definitions.TryGetValue(name, out var definition) || !IsChapterScoped(definition))
                return true;
            var owner = definition.Chapter;
            return string.IsNullOrEmpty(owner)
                || string.Equals(owner, chapterId ?? CurrentChapterId, StringComparison.Ordinal);
        }

        /// <summary>
        /// Imports the legacy flat Dictionary as global values. This intentionally
        /// preserves the 0.1 entry point rather than guessing chapter ownership.
        /// </summary>
        public void ImportLegacyDictionary(Dictionary<string, object> values)
        {
            if (values == null)
                return;
            foreach (var entry in values)
                SetGlobal(entry.Key, entry.Value);
        }

        /// <summary>Returns the effective flat view expected by the 0.1 API.</summary>
        public Dictionary<string, object> ToDictionary()
        {
            var result = new Dictionary<string, object>(_globalValues);
            foreach (var entry in EnsureChapter(CurrentChapterId))
                result[entry.Key] = entry.Value;
            return result;
        }

        public IReadOnlyDictionary<string, object> GlobalValues => _globalValues;

        public IReadOnlyDictionary<string, Dictionary<string, object>> ChapterValues => _chapterValues;

        private Dictionary<string, object> EnsureChapter(string chapterId)
        {
            chapterId = chapterId ?? string.Empty;
            if (!_chapterValues.TryGetValue(chapterId, out var values))
            {
                values = new Dictionary<string, object>();
                _chapterValues[chapterId] = values;
            }

            foreach (var entry in _definitions)
            {
                var definition = entry.Value;
                if (!IsChapterScoped(definition) || values.ContainsKey(entry.Key))
                    continue;
                // Legacy 0.1 declarations may pin a chapter explicitly.
                if (!string.IsNullOrEmpty(definition.Chapter)
                    && !string.Equals(definition.Chapter, chapterId, StringComparison.Ordinal))
                    continue;
                values[entry.Key] = ResolveDefaultValue(definition);
            }
            return values;
        }

        private static bool IsChapterScoped(VariableDeclaration definition)
        {
            return definition != null
                && string.Equals(definition.Scope, "chapter", StringComparison.OrdinalIgnoreCase);
        }

        internal static object ResolveDefaultValue(VariableDeclaration definition)
        {
            if (definition == null)
                return null;
            if (definition.DefaultValue != null)
                return NormalizeJsonValue(definition.DefaultValue);

            switch (definition.Type)
            {
                case "int": return 0L;
                case "float": return 0.0d;
                case "bool": return false;
                case "string": return string.Empty;
                case "enum":
                    return definition.Values != null && definition.Values.Count > 0
                        ? definition.Values[0]
                        : string.Empty;
                case "object":
                    var fields = new Dictionary<string, object>();
                    foreach (var field in definition.Fields ?? new Dictionary<string, VariableDeclaration>())
                        fields[field.Key] = ResolveDefaultValue(field.Value);
                    return fields;
                default:
                    return null;
            }
        }

        internal static object NormalizeJsonValue(object value)
        {
            if (value is JObject jsonObject)
            {
                var result = new Dictionary<string, object>();
                foreach (var property in jsonObject.Properties())
                    result[property.Name] = NormalizeJsonValue(property.Value);
                return result;
            }
            if (value is JArray jsonArray)
            {
                var result = new List<object>();
                foreach (var item in jsonArray)
                    result.Add(NormalizeJsonValue(item));
                return result;
            }
            if (value is JValue jsonValue)
                return jsonValue.Value;
            return value;
        }
    }
}
