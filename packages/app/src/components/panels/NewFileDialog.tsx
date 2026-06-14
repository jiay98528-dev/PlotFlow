import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { applyTemplate, t } from '@plotflow/core';
import {
  BUILTIN_TEMPLATES,
  type BuiltinTemplate,
} from '../../templates/builtinTemplates';

export interface NewFileDialogProps {
  readonly onClose: () => void;
  readonly onTemplateSelected: (
    template: string,
    meta: { readonly title: string; readonly author: string },
  ) => void;
}

const DEFAULT_TITLE = 'Untitled Story';
const DEFAULT_AUTHOR = 'PlotFlow Writer';

export function NewFileDialog({
  onClose,
  onTemplateSelected,
}: NewFileDialogProps): React.ReactElement {
  const [selectedId, setSelectedId] = useState<BuiltinTemplate['id']>('rpg-dialogue');
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [author, setAuthor] = useState(DEFAULT_AUTHOR);

  const selectedTemplate = useMemo(() => {
    const fallback: BuiltinTemplate = {
      id: 'blank', titleKey: 'dialogs.blankFile', title: 'Blank',
      description: '', nodeCount: 0, engine: 'generic', accent: 'heading', content: '',
    };
    return BUILTIN_TEMPLATES.find((t) => t.id === selectedId) ?? BUILTIN_TEMPLATES[0] ?? fallback;
  }, [selectedId]);

  const renderedPreview = useMemo(() => {
    return applyTemplate(selectedTemplate.content, {
      title: title.trim() || DEFAULT_TITLE,
      author: author.trim() || DEFAULT_AUTHOR,
      engine: selectedTemplate.engine,
    });
  }, [author, selectedTemplate, title]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const handleCreate = useCallback(() => {
    const meta = {
      title: title.trim() || DEFAULT_TITLE,
      author: author.trim() || DEFAULT_AUTHOR,
    };
    onTemplateSelected(
      applyTemplate(selectedTemplate.content, {
        title: meta.title,
        author: meta.author,
        engine: selectedTemplate.engine,
      }),
      meta,
    );
    onClose();
  }, [author, onClose, onTemplateSelected, selectedTemplate, title]);

  return (
    <div
      className="new-file-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-file-title"
      onClick={handleOverlayClick}
    >
      <section className="new-file-dialog__panel">
        <header className="new-file-dialog__header">
          <div>
            <p className="new-file-dialog__eyebrow">M6 Templates</p>
            <h2 id="new-file-title">{t('dialogs.newFile')}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={t('dialogs.close')}
            onClick={onClose}
          >
            <X aria-hidden="true" size={16} strokeWidth={2} />
          </button>
        </header>

        <div className="new-file-dialog__body">
          <aside className="new-file-dialog__sidebar">
            <label className="form-field">
              <span>{t('dialogs.title')}</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={DEFAULT_TITLE}
              />
            </label>
            <label className="form-field">
              <span>{t('dialogs.author')}</span>
              <input
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
                placeholder={DEFAULT_AUTHOR}
              />
            </label>

            <div className="template-grid" aria-label={t('dialogs.template')}>
              {BUILTIN_TEMPLATES.map((template) => {
                const isSelected = template.id === selectedId;
                return (
                  <button
                    key={template.id}
                    type="button"
                    className={`template-card template-card--${template.accent}${isSelected ? ' is-selected' : ''}`}
                    onClick={() => setSelectedId(template.id)}
                    aria-pressed={isSelected}
                  >
                    <span className="template-card__header">
                      <span className="template-card__title">{t(template.titleKey)}</span>
                      {isSelected && (
                        <CheckCircle2
                          className="template-card__check"
                          aria-hidden="true"
                          size={16}
                          strokeWidth={2.2}
                        />
                      )}
                    </span>
                    <span className="template-card__description">{template.description}</span>
                    <span className="template-card__meta">
                      {template.nodeCount} nodes / {template.engine}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="new-file-dialog__preview">
            <div className="preview-toolbar">
              <div>
                <span className="preview-toolbar__label">{t('dialogs.preview')}</span>
                <strong>{t(selectedTemplate.titleKey)}</strong>
              </div>
              <span className={`template-chip template-chip--${selectedTemplate.accent}`}>
                {selectedTemplate.nodeCount} nodes
              </span>
            </div>
            <pre className="template-preview" aria-label={t('dialogs.preview')}>
              {renderedPreview}
            </pre>
          </main>
        </div>

        <footer className="new-file-dialog__footer">
          <button type="button" className="button button--secondary" onClick={onClose}>
            {t('dialogs.cancel')}
          </button>
          <button type="button" className="button button--primary" onClick={handleCreate}>
            {t('dialogs.create')}
          </button>
        </footer>
      </section>
    </div>
  );
}
