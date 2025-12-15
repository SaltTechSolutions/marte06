// src/components/BottomSheet.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import BottomSheet, { ActionSheet } from './BottomSheet';
import { Button } from '../newUI/primitives';
import { FiEdit2, FiTrash2, FiShare } from 'react-icons/fi';

const meta: Meta<typeof BottomSheet> = {
    title: 'Components/BottomSheet',
    component: BottomSheet,
    parameters: {
        layout: 'fullscreen',
    },
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Interactive BottomSheet demo
const BottomSheetDemo = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div style={{ padding: '2rem' }}>
            <Button onClick={() => setIsOpen(true)}>Bottom Sheet Aç</Button>
            <BottomSheet
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                title="Üye Detayları"
            >
                <div style={{ padding: '1rem' }}>
                    <h4>Ahmet Yılmaz</h4>
                    <p>E-posta: ahmet@example.com</p>
                    <p>Telefon: 0532 123 45 67</p>
                    <p>Aktif Paket: Yoga 8 Ders</p>
                    <p>Kalan Ders: 5</p>
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                        <Button variant="primary">Ders Planla</Button>
                        <Button variant="neutral" tone="outline">Düzenle</Button>
                    </div>
                </div>
            </BottomSheet>
        </div>
    );
};

export const Default: Story = {
    render: () => <BottomSheetDemo />,
};

// ActionSheet demo
const ActionSheetDemo = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div style={{ padding: '2rem' }}>
            <Button onClick={() => setIsOpen(true)}>Action Sheet Aç</Button>
            <ActionSheet
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                title="Üye İşlemleri"
                items={[
                    {
                        label: 'Düzenle',
                        icon: <FiEdit2 />,
                        onClick: () => console.log('Düzenle clicked'),
                    },
                    {
                        label: 'Paylaş',
                        icon: <FiShare />,
                        onClick: () => console.log('Paylaş clicked'),
                    },
                    {
                        label: 'Sil',
                        icon: <FiTrash2 />,
                        onClick: () => console.log('Sil clicked'),
                        destructive: true,
                    },
                ]}
            />
        </div>
    );
};

export const ActionSheetExample: Story = {
    render: () => <ActionSheetDemo />,
};

// Multi-snap demo
const MultiSnapDemo = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div style={{ padding: '2rem' }}>
            <Button onClick={() => setIsOpen(true)}>Çok Seviyeli Sheet</Button>
            <BottomSheet
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                title="Ders Listesi"
                snapPoints={[0.9, 0.5, 0.25, 0]}
                initialSnap={2}
            >
                <div style={{ padding: '1rem' }}>
                    {Array.from({ length: 20 }, (_, i) => (
                        <div
                            key={i}
                            style={{
                                padding: '1rem',
                                borderBottom: '1px solid #e5e7eb',
                            }}
                        >
                            Ders {i + 1} - 0{8 + Math.floor(i / 2)}:00
                        </div>
                    ))}
                </div>
            </BottomSheet>
        </div>
    );
};

export const MultipleSnapPoints: Story = {
    render: () => <MultiSnapDemo />,
};
