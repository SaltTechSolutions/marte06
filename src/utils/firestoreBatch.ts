import { db } from '../firebaseConfig';
import { writeBatch, DocumentReference, UpdateData, WithFieldValue, SetOptions } from 'firebase/firestore';

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
        set: <T>(ref: DocumentReference<T>, data: WithFieldValue<T>, options?: SetOptions) => {
            checkLimit();
            if (options) {
                batches[currentBatchIndex].set(ref, data, options);
            } else {
                batches[currentBatchIndex].set(ref, data);
            }
            currentOperationCount++;
        },
        update: <T>(ref: DocumentReference<T>, data: UpdateData<T>) => {
            checkLimit();
            batches[currentBatchIndex].update(ref, data);
            currentOperationCount++;
        },
        delete: <T>(ref: DocumentReference<T>) => {
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
