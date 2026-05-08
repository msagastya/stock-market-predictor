const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'stock-market-predictor-ace63';
const API_KEY = process.env.FIREBASE_API_KEY || '';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export async function firestoreSet(collection: string, docId: string, data: Record<string, string>) {
    const fields: Record<string, { stringValue: string }> = {};
    for (const [k, v] of Object.entries(data)) {
        fields[k] = { stringValue: v };
    }
    const url = `${BASE}/${collection}/${docId}?key=${API_KEY}`;
    const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
    });
    if (!res.ok) throw new Error(`Firestore set failed: ${await res.text()}`);
}

export async function firestoreGet(collection: string, docId: string): Promise<Record<string, string> | null> {
    const url = `${BASE}/${collection}/${docId}?key=${API_KEY}`;
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Firestore get failed: ${await res.text()}`);
    const json = await res.json();
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(json.fields || {})) {
        result[k] = (v as any).stringValue;
    }
    return result;
}
