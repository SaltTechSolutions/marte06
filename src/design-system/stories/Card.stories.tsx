// src/design-system/stories/Card.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card, CardHeader, CardContent, CardFooter, Button, Avatar, Badge } from '../components';
import { FiMoreVertical, FiEdit2 } from 'react-icons/fi';

const meta: Meta<typeof Card> = {
    title: 'Design System/Card',
    component: Card,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: 'select',
            options: ['elevated', 'outlined', 'filled'],
        },
        padding: {
            control: 'select',
            options: ['none', 'sm', 'md', 'lg'],
        },
        interactive: { control: 'boolean' },
    },
    decorators: [
        (Story) => (
            <div style={{ width: '360px' }}>
                <Story />
            </div>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Elevated: Story = {
    args: {
        variant: 'elevated',
        children: (
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                Bu bir elevated (gölgeli) kart örneğidir.
            </p>
        ),
    },
};

export const Outlined: Story = {
    args: {
        variant: 'outlined',
        children: (
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                Bu bir outlined (kenarlıklı) kart örneğidir.
            </p>
        ),
    },
};

export const Filled: Story = {
    args: {
        variant: 'filled',
        children: (
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                Bu bir filled (dolgulu) kart örneğidir.
            </p>
        ),
    },
};

export const Interactive: Story = {
    args: {
        variant: 'elevated',
        interactive: true,
        children: (
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                Hover yapıldığında yükselen interaktif kart.
            </p>
        ),
    },
};

export const WithHeaderAndContent: Story = {
    args: {
        variant: 'outlined',
        padding: 'none',
    },
    render: (args) => (
        <Card {...args}>
            <CardHeader
                title="Üye Bilgileri"
                subtitle="Son güncelleme: Bugün"
                action={
                    <Button variant="ghost" size="sm">
                        <FiMoreVertical />
                    </Button>
                }
            />
            <CardContent>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Avatar name="Ahmet Yılmaz" size="lg" />
                    <div>
                        <p style={{ margin: 0, fontWeight: 600 }}>Ahmet Yılmaz</p>
                        <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                            ahmet@example.com
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    ),
};

export const MemberCard: Story = {
    render: () => (
        <Card variant="outlined" padding="none">
            <CardHeader
                title="Mehmet Kaya"
                subtitle="Aktif Üye"
                action={<Badge variant="success">Aktif</Badge>}
            />
            <CardContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Telefon</span>
                        <span>0532 123 45 67</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Paket</span>
                        <span>Yoga 8 Ders</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Kalan Ders</span>
                        <span style={{ color: 'var(--color-primary-600)', fontWeight: 600 }}>5</span>
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                <Button variant="secondary" size="sm" fullWidth leftIcon={<FiEdit2 />}>
                    Düzenle
                </Button>
            </CardFooter>
        </Card>
    ),
};

export const StatsCard: Story = {
    render: () => (
        <Card variant="elevated">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-secondary)' }}>Toplam Üye</p>
                    <p style={{ margin: '8px 0 0', fontSize: '32px', fontWeight: 700 }}>248</p>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--color-success-600)' }}>
                        +12% bu ay
                    </p>
                </div>
                <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'var(--color-primary-100)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-primary-600)',
                    fontSize: '24px'
                }}>
                    👥
                </div>
            </div>
        </Card>
    ),
};
