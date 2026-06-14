@tool
class_name PlotFlowConditionEval
extends RefCounted

## Evaluates PlotFlow conditions against a VariableStore.
##
## Supported operators:
##   eq   — equal
##   neq  — not equal
##   gt   — greater than
##   gte  — greater than or equal
##   lt   — less than
##   lte  — less than or equal
##   has  — string contains
##   in   — value is in a comma-separated list
##
## Condition syntax (as produced by the PlotFlow editor):
##   [condition: variable operator value]
## Example:
##   [condition: health lt 50]


## Evaluate a single condition string.
## Returns true if the condition passes.
static func evaluate(condition: String, store: PlotFlowVariableStore) -> bool:
	condition = condition.strip_edges()

	# Strip optional [condition: ...] wrapper.
	if condition.begins_with("[condition:") and condition.ends_with("]"):
		condition = condition.substr(11, condition.length() - 12).strip_edges()
	elif condition.begins_with("[") and condition.ends_with("]"):
		condition = condition.substr(1, condition.length() - 2).strip_edges()

	# Parse: variable operator value
	var parts := _split_condition(condition)
	if parts.size() < 3:
		push_warning("PlotFlow ConditionEval: malformed condition '%s'" % condition)
		return false

	var var_name := parts[0].strip_edges()
	var op := parts[1].strip_edges()
	var raw_value := parts[2].strip_edges()

	# Resolve variable value from the store.
	var actual := store.get_var(var_name)
	if actual == null:
		# If the variable is missing, the condition fails unless we treat
		# it as a literal.  Here we fail closed.
		return false

	# Parse expected value.
	var expected := _parse_value(raw_value)

	match op:
		"eq", "==", "=":
			return actual == expected
		"neq", "!=":
			return actual != expected
		"gt", ">":
			return float(actual) > float(expected)
		"gte", ">=":
			return float(actual) >= float(expected)
		"lt", "<":
			return float(actual) < float(expected)
		"lte", "<=":
			return float(actual) <= float(expected)
		"has":
			return str(actual).find(str(expected)) >= 0
		"in":
			var items := str(expected).split(",")
			for item in items:
				if str(actual).strip_edges() == item.strip_edges():
					return true
			return false
		_:
			push_warning("PlotFlow ConditionEval: unknown operator '%s'" % op)
			return false


## Evaluate multiple conditions joined by [code]and[/code] / [code]or[/code].
## Each element in [code]conditions[/code] is a raw condition string.
## [code]join[/code] should be "and" or "or" (default "and").
static fn evaluate_many(conditions: Array[String], store: PlotFlowVariableStore, join: String = "and") -> bool:
	if conditions.is_empty():
		return true

	var results: Array[bool]
	for c in conditions:
		results.append(evaluate(c, store))

	match join:
		"or":
			return results.any(func(r): return r)
		_:
			return results.all(func(r): return r)


## Split "var op value" into three tokens, respecting quotes.
static func _split_condition(text: String) -> PackedStringArray:
	var tokens: PackedStringArray
	var current := ""
	var in_quote := false

	for ch in text:
		if ch == "\"":
			in_quote = not in_quote
			current += ch
		elif ch == " " and not in_quote:
			if not current.is_empty():
				tokens.append(current)
				current = ""
		else:
			current += ch

	if not current.is_empty():
		tokens.append(current)

	return tokens


## Parse a string value into bool / int / float / string.
static func _parse_value(text: String) -> Variant:
	if text.is_empty():
		return ""

	# Strip surrounding quotes.
	var raw := text
	if raw.begins_with("\"") and raw.ends_with("\""):
		return raw.substr(1, raw.length() - 2)

	# Boolean.
	if raw.to_lower() in ["true", "yes"]:
		return true
	if raw.to_lower() in ["false", "no"]:
		return false

	# Integer.
	if raw.is_valid_int():
		return int(raw)

	# Float.
	if raw.is_valid_float():
		return float(raw)

	# Fallback: string.
	return raw
