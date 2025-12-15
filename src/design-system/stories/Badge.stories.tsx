// src/design-system/stories/Badge.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge, StatusBadge } from '../components';

const meta: Meta<typeof Badge> = {
    title: 'Design System/Badge',
    component: Badge,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: 'select',
            options: ['default', 'primary', 'success', 'warning', 'error', 'info'],
        },
        size: {
            control: 'select',
            options: ['sm', 'md'],
        },
        dot: { control: 'boolean' },
    },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        variant: 'default',
        children: 'Badge',
    },
};

export const Primary: Story = {
    args: {
        variant: 'primary',
        children: 'Yeni',
    },
};

export const Success: Story = {
    args: {
        variant: 'success',
        children: 'Aktif',
    },
};

export const Warning: Story = {
    args: {
        variant: 'warning',
        children: 'Bekliyor',
    },
};

export const Error: Story = {
    args: {
        variant: 'error',
        children: 'İptal',
    },
};

export const WithDot: Story = {
    args: {
        variant: 'success',
        children: 'Çevrimiçi',
        dot: true,
    },
};

export const AllVariants: Story = {
    render: () => (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Badge variant="default">Default</Badge>
            <Badge variant="primary">Primary</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="error">Error</Badge>
            <Badge variant="info">Info</Badge>
        </div>
    ),
};

export const Sizes: Story = {
    render: () => (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Badge size="sm" variant="primary">Small</Badge>
            <Badge size="md" variant="primary">Medium</Badge>
        </div>
    ),
};

export const StatusBadges: Story = {
    render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <StatusBadge status="online" />
            <StatusBadge status="offline" />
            <StatusBadge status="busy" />
            <StatusBadge status="away" />
        </div>
    ),
};

export const UseCases: Story = {
    render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>Üye Durumu:</span>
                <Badge variant="success">Aktif</Badge>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>Paket Durumu:</span>
                <Badge variant="warning">Süresi Doluyor</Badge>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>Ders:</span>
                <Badge variant="error">İptal Edildi</Badge>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>Ödeme:</span>
                <Badge variant="info">Beklemede</Badge>
            </div>
        </div>
    ),
};
