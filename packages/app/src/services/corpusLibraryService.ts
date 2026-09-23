import { CorpusImporter, NGramEngine, PreprocessingPipeline } from '@plotflow/core';

export interface WritingMaterial {
  readonly id: string;
  readonly name: string;
  readonly content: string;
  readonly type: 'txt' | 'csv' | 'mdstory';
  readonly size: number;
  readonly count: number;
  readonly enabled: boolean;
  readonly addedAt: number;
}
let model = new NGramEngine();
let snapshot: readonly WritingMaterial[] = [];
let queue: Promise<unknown> = Promise.resolve();

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('plotflow-writing-materials', 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore('materials', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function train(materials: readonly WritingMaterial[]): NGramEngine {
  const next = new NGramEngine();
  const importer = new CorpusImporter();
  const pipeline = new PreprocessingPipeline();
  for (const item of materials.filter((entry) => entry.enabled)) {
    const result = importer.importFromFile({
      fileName: item.name,
      content: item.content,
      size: item.size,
      type: item.type,
    });
    pipeline.processAndTrain(result.entries, next);
  }
  return next;
}

export async function loadWritingMaterials(): Promise<readonly WritingMaterial[]> {
  const db = await database();
  try {
    const items = await new Promise<WritingMaterial[]>((resolve, reject) => {
      const request = db.transaction('materials').objectStore('materials').getAll();
      request.onsuccess = () => resolve(request.result as WritingMaterial[]);
      request.onerror = () => reject(request.error);
    });
    snapshot = items;
    model = train(items);
    return items;
  } finally {
    db.close();
  }
}

export function saveWritingMaterials(items: readonly WritingMaterial[]): Promise<void> {
  const save = async () => {
    if (items.reduce((size, item) => size + item.size, 0) > 50 * 1024 * 1024)
      throw new Error('50 MB');
    const nextModel = train(items);
    const db = await database();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('materials', 'readwrite');
        const store = tx.objectStore('materials');
        store.clear();
        for (const item of items) store.put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      snapshot = items;
      model = nextModel;
    } finally {
      db.close();
    }
  };
  const result = queue.then(save);
  queue = result.catch(() => {});
  return result;
}

export function prepareWritingMaterial(name: string, content: string): WritingMaterial {
  const extension = name.split('.').at(-1)?.toLowerCase();
  if (extension !== 'txt' && extension !== 'csv' && extension !== 'mdstory')
    throw new Error('.txt / .csv / .mdstory');
  const size = new TextEncoder().encode(content).length;
  if (size > 10 * 1024 * 1024) throw new Error('10 MB');
  const result = new CorpusImporter().importFromFile({
    fileName: name,
    content,
    size,
    type: extension,
  });
  if (!result.entries.length) throw new Error('Empty text');
  return {
    id: crypto.randomUUID(),
    name,
    content,
    size,
    type: extension,
    count: result.newEntriesCount,
    enabled: true,
    addedAt: Date.now(),
  };
}

export function writingMaterialSuggestions(context: string, limit = 1): string[] {
  return snapshot.some((item) => item.enabled) ? model.predict(context, limit) : [];
}
