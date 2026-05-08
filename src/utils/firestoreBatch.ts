import { db } from '../firebaseConfig';
import { writeBatch } from 'firebase/firestore';
import type { DocumentReference } from 'firebase/firestore';

const BATCH_LIMIT = 490; // Safely below Firestore's 500 limit

export const createChunkedBatch = () => {
    let batches = [writeBatch(db)];
    let currentBatchIndex = 0;
    let currentOperationCount = 0;

    const checkLimit = () => {
        if (currentOperationCount >= BATCH_LIMIT) {
            batches.push(writeBatch(db));
            currentBatchIndex++;
            currentOperationCount = 0;
        }
    };

    return {
        set: (ref: DocumentReference<any>, data: any, options?: any) => {
            checkLimit();
            if (options) {
                batches[currentBatchIndex].set(ref, data, options);
            } else {
                batches[currentBatchIndex].set(ref, data);
            }
            currentOperationCount++;
        },
        update: (ref: DocumentReference<any>, data: any) => {
            checkLimit();
            batches[currentBatchIndex].update(ref, data);
            currentOperationCount++;
        },
        delete: (ref: DocumentReference<any>) => {
            checkLimit();
            batches[currentBatchIndex].delete(ref);
            currentOperationCount++;
        },
        commit: async () => {
            for (const batch of batches) {
                if (currentOperationCount > 0 || batches.length > 1) { // Only commit if there's an operation
                    await batch.commit();
                }
            }
        }
    };
};
