// src/components/SwipeableCard.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SwipeableCard, DELETE_ACTION, EDIT_ACTION, COMPLETE_ACTION } from '../newUI/primitives';
import { FiUser, FiPhone, FiMail } from 'react-icons/fi';

const meta: Meta<typeof SwipeableCard> = {
    title: 'Components/SwipeableCard',
    component: SwipeableCard,
    parameters: {
        layout: 'padded',
    },
    tags: ['autodocs'],
    decorators: [
        (Story) => (
            <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                    👆 Kartları sola veya sağa kaydırın
                </p>
                <Story />
            </div>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof meta>;

const MemberCard = ({ name, phone, email }: { name: string; phone: string; email: string }) => (
    <div style={{
        padding: '1rem',
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '0.75rem',
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
            }}>
                <FiUser size={20} />
            </div>
            <div>
                <h4 style={{ margin: 0, fontWeight: 600 }}>{name}</h4>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.875rem', color: '#6b7280' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <FiPhone size={12} /> {phone}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <FiMail size={12} /> {email}
                    </span>
                </div>
            </div>
        </div>
    </div>
);

export const DeleteOnSwipe: Story = {
    render: () => (
        <SwipeableCard
            rightActions={[
                { ...DELETE_ACTION, onClick: () => alert('Silindi!') },
            ]}
        >
            <MemberCard name="Ahmet Yılmaz" phone="0532 123 45 67" email="ahmet@example.com" />
        </SwipeableCard>
    ),
};

export const EditAndDelete: Story = {
    render: () => (
        <SwipeableCard
            rightActions={[
                { ...EDIT_ACTION, onClick: () => alert('Düzenleniyor...') },
                { ...DELETE_ACTION, onClick: () => alert('Silindi!') },
            ]}
        >
            <MemberCard name="Mehmet Kaya" phone="0533 234 56 78" email="mehmet@example.com" />
        </SwipeableCard>
    ),
};

export const CompleteOnSwipeRight: Story = {
    render: () => (
        <SwipeableCard
            leftActions={[
                { ...COMPLETE_ACTION, onClick: () => alert('Tamamlandı!') },
            ]}
            rightActions={[
                { ...DELETE_ACTION, onClick: () => alert('Silindi!') },
            ]}
        >
            <MemberCard name="Ayşe Demir" phone="0534 345 67 89" email="ayse@example.com" />
        </SwipeableCard>
    ),
};

export const MultipleCards: Story = {
    render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[
                { name: 'Ali Veli', phone: '0535 111 22 33', email: 'ali@example.com' },
                { name: 'Fatma Yıldız', phone: '0536 222 33 44', email: 'fatma@example.com' },
                { name: 'Mustafa Öz', phone: '0537 333 44 55', email: 'mustafa@example.com' },
            ].map((member) => (
                <SwipeableCard
                    key={member.email}
                    rightActions={[
                        { ...EDIT_ACTION, onClick: () => console.log('Edit', member.name) },
                        { ...DELETE_ACTION, onClick: () => console.log('Delete', member.name) },
                    ]}
                >
                    <MemberCard {...member} />
                </SwipeableCard>
            ))}
        </div>
    ),
};
