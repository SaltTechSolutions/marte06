// src/components/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../newUI/primitives';
import { FiPlus, FiSave } from 'react-icons/fi';

const meta: Meta<typeof Button> = {
    title: 'Primitives/Button',
    component: Button,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: 'select',
            options: ['primary', 'neutral', 'danger'],
            description: 'Button variant',
        },
        tone: {
            control: 'select',
            options: ['solid', 'soft', 'outline', 'ghost'],
            description: 'Button tone',
        },
        size: {
            control: 'select',
            options: ['sm', 'md', 'lg'],
            description: 'Button size',
        },
        disabled: {
            control: 'boolean',
            description: 'Disabled state',
        },
        loading: {
            control: 'boolean',
            description: 'Loading state',
        },
        fullWidth: {
            control: 'boolean',
            description: 'Full width button',
        },
    },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
    args: {
        children: 'Primary Button',
        variant: 'primary',
        tone: 'solid',
    },
};

export const Neutral: Story = {
    args: {
        children: 'Neutral Button',
        variant: 'neutral',
        tone: 'solid',
    },
};

export const Danger: Story = {
    args: {
        children: 'Danger Button',
        variant: 'danger',
        tone: 'solid',
    },
};

export const Outline: Story = {
    args: {
        children: 'Outline Button',
        variant: 'primary',
        tone: 'outline',
    },
};

export const Ghost: Story = {
    args: {
        children: 'Ghost Button',
        variant: 'neutral',
        tone: 'ghost',
    },
};

export const WithIcon: Story = {
    args: {
        children: 'Kaydet',
        variant: 'primary',
        icon: <FiSave />,
    },
};

export const IconOnly: Story = {
    args: {
        children: <FiPlus />,
        variant: 'primary',
        'aria-label': 'Ekle',
    },
};

export const Loading: Story = {
    args: {
        children: 'Yükleniyor...',
        variant: 'primary',
        loading: true,
    },
};

export const Disabled: Story = {
    args: {
        children: 'Disabled',
        variant: 'primary',
        disabled: true,
    },
};

export const Sizes: Story = {
    render: () => (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
        </div>
    ),
};

export const AllVariants: Story = {
    render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="primary" tone="solid">Primary Solid</Button>
                <Button variant="primary" tone="soft">Primary Soft</Button>
                <Button variant="primary" tone="outline">Primary Outline</Button>
                <Button variant="primary" tone="ghost">Primary Ghost</Button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="neutral" tone="solid">Neutral Solid</Button>
                <Button variant="neutral" tone="soft">Neutral Soft</Button>
                <Button variant="neutral" tone="outline">Neutral Outline</Button>
                <Button variant="neutral" tone="ghost">Neutral Ghost</Button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="danger" tone="solid">Danger Solid</Button>
                <Button variant="danger" tone="soft">Danger Soft</Button>
                <Button variant="danger" tone="outline">Danger Outline</Button>
                <Button variant="danger" tone="ghost">Danger Ghost</Button>
            </div>
        </div>
    ),
};
