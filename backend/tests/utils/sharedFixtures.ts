import fs from 'fs';
import path from 'path';

type FixturePath = string | string[];

const sharedMocksRoot = path.resolve(__dirname, '../../../shared/mocks');

function toPathSegments(pathOrSegments: FixturePath): string[] {
    return Array.isArray(pathOrSegments) ? pathOrSegments : pathOrSegments.split('/').filter(Boolean);
}

export function loadSharedFixture<T>(pathOrSegments: FixturePath): T {
    const filePath = path.join(sharedMocksRoot, ...toPathSegments(pathOrSegments));
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
}

// Convenience handles for the most commonly used fixtures
export const SharedFixtures = {
    dishes: loadSharedFixture<{ success: boolean; data: { dishes: any[] } }>(['dishes', '200.json']),
    orders: loadSharedFixture<{ success: boolean; data: { orders: any[]; total: number } }>(['orders', '200.json'])
};
