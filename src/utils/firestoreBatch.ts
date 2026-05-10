import { db } from '../firebaseConfig';
import { writeBatch } from 'firebase/firestore';
import type { DocumentReference, SetOptions, WithFieldValue } from 'firebase/firestore';

const BATCH_LIMIT = 490; // Safely below Firestore's 500 limit

export const createChunkedBatch = () => {
    let batches = [writeBatch(db)];
    let currentBatchIndex = 0;
    let currentOperationCount = 0;
    let totalOperationCount = 0;

    const checkLimit = () => {
        if (currentOperationCount >= BATCH_LIMIT) {
            batches.push(writeBatch(db));
            currentBatchIndex++;
            currentOperationCount = 0;
        }
    };

    return {
        set: <T>(ref: DocumentReference<T>, data: WithFieldValue<T>, options?: SetOptions) => {
            checkLimit();
            if (options) {
                batches[currentBatchIndex].set(ref, data, options);
            } else {
                batches[currentBatchIndex].set(ref, data);
            }
            currentOperationCount++;
            totalOperationCount++;
        },
        update: <T>(ref: DocumentReference<T>, data: Record<string, any>) => {
            checkLimit();
            batches[currentBatchIndex].update(ref, data);
            currentOperationCount++;
            totalOperationCount++;
        },
        delete: <T>(ref: DocumentReference<T>) => {
            checkLimit();
            batches[currentBatchIndex].delete(ref);
            currentOperationCount++;
            totalOperationCount++;
        },
        commit: async () => {
            if (totalOperationCount === 0) return;
            for (const batch of batches) {
                await batch.commit();
            }
        }
    };
};
