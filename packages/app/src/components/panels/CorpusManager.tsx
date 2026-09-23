import React, { useEffect, useRef, useState } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAppText } from '../../i18n/appI18n';
import { UXDialog } from '../graph-lab/UXDialog';
import {
  loadWritingMaterials,
  prepareWritingMaterial,
  saveWritingMaterials,
  type WritingMaterial,
} from '../../services/corpusLibraryService';

export function CorpusManager(): React.ReactElement | null {
  const open = useUIStore((state) => state.isCorpusManagerOpen);
  const close = useUIStore((state) => state.closeCorpusManager);
  const text = useAppText();
  const [items, setItems] = useState<readonly WritingMaterial[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pasting, setPasting] = useState(false);
  const [draft, setDraft] = useState('');
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<WritingMaterial | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    let current = true;
    setBusy(true);
    setError('');
    void loadWritingMaterials()
      .then((values) => {
        if (current) setItems(values);
      })
      .catch((reason: unknown) => {
        if (current) setError(String(reason));
      })
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [open]);
  const persist = async (next: readonly WritingMaterial[]) => {
    setBusy(true);
    setError('');
    try {
      await saveWritingMaterials(next);
      setItems(next);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const importFiles = async (files: FileList | null) => {
    if (!files || busy) return;
    setBusy(true);
    setError('');
    try {
      const added: WritingMaterial[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) throw new Error(text('corpus.footer'));
        added.push(prepareWritingMaterial(file.name, await file.text()));
      }
      await persist([...items, ...added]);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };
  if (!open) return null;
  return (
    <UXDialog
      title={text('corpus.title')}
      wide
      onClose={() => {
        if (!busy) close();
      }}
    >
      <div className="ux-library" aria-busy={busy}>
        <p>{text('ux.materialHint')}</p>
        <div className="ux-library__toolbar">
          <button
            type="button"
            className="button button--primary"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <Plus size={16} />
            {text(busy ? 'corpus.importing' : 'corpus.importCorpus')}
          </button>
          <input
            hidden
            ref={fileInput}
            type="file"
            multiple
            accept=".txt,.csv,.mdstory"
            data-testid="writing-material-files"
            onChange={(event) => {
              void importFiles(event.target.files);
            }}
          />
          <button
            type="button"
            className="button button--secondary"
            disabled={busy}
            onClick={() => setPasting(true)}
          >
            {text('corpus.importFromText')}
          </button>
          <span>{text('corpus.sourceCount', { count: items.length })}</span>
        </div>
        {error && (
          <p role="alert" className="ux-error">
            {text('corpus.importFailed', { message: error })}
          </p>
        )}
        {busy && <p role="status">{text('common.processing')}</p>}
        {!items.length && !busy && (
          <div className="ux-empty">
            <FileText size={32} />
            <h3>{text('corpus.empty')}</h3>
            <p>{text('corpus.emptyHint')}</p>
          </div>
        )}
        <div className="ux-library__list">
          {items.map((item) => (
            <div className="ux-library__row" key={item.id}>
              <FileText size={20} />
              <div>
                <strong>{item.name}</strong>
                <small>
                  {Math.ceil(item.size / 1024)} KB ·{' '}
                  {text('corpus.itemEntries', { count: item.count })}
                </small>
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={item.enabled}
                  disabled={busy}
                  onChange={() => {
                    void persist(
                      items.map((entry) =>
                        entry.id === item.id ? { ...entry, enabled: !entry.enabled } : entry,
                      ),
                    );
                  }}
                />
                {text(item.enabled ? 'corpus.active' : 'corpus.disabled')}
              </label>
              <button
                type="button"
                className="icon-button icon-button--danger"
                disabled={busy}
                aria-label={text('corpus.delete')}
                onClick={() => setDeleting(item)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <p className="graph-lab-control-hint">{text('corpus.footer')}</p>
      </div>
      {pasting && (
        <UXDialog
          title={text('corpus.importFromText')}
          onClose={() => {
            if (!busy) setPasting(false);
          }}
        >
          <label className="graph-lab-field">
            <span>{text('ux.materialName')}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={text('ux.materialName')}
            />
          </label>
          <label className="graph-lab-field">
            <span>{text('ux.pasteText')}</span>
            <textarea
              data-testid="writing-material-text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={10}
            />
          </label>
          <button
            type="button"
            className="button button--primary"
            disabled={busy || !draft.trim()}
            onClick={() => {
              try {
                const item = prepareWritingMaterial(
                  `${name.trim() || text('ux.materialName')}.txt`,
                  draft,
                );
                void persist([...items, item]).then((saved) => {
                  if (saved) {
                    setPasting(false);
                    setDraft('');
                    setName('');
                  }
                });
              } catch (reason) {
                setError(String(reason));
              }
            }}
          >
            {text('corpus.importCorpus')}
          </button>
          {error && (
            <p role="alert" className="ux-error">
              {text('corpus.importFailed', { message: error })}
            </p>
          )}
        </UXDialog>
      )}
      {deleting && (
        <UXDialog title={text('corpus.confirmDeleteTitle')} onClose={() => setDeleting(null)}>
          <p>{text('corpus.confirmDelete', { file: deleting.name })}</p>
          <p>{text('corpus.deleteWarning')}</p>
          <div className="ux-dialog__actions">
            <button
              type="button"
              className="button button--secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              {text('common.cancel')}
            </button>
            <button
              type="button"
              className="button ux-danger"
              disabled={busy}
              onClick={() => {
                void persist(items.filter((item) => item.id !== deleting.id)).then((saved) => {
                  if (saved) setDeleting(null);
                });
              }}
            >
              {text('corpus.confirmDeleteAction')}
            </button>
          </div>
        </UXDialog>
      )}
    </UXDialog>
  );
}
