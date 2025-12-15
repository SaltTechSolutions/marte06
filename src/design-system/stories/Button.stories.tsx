// src/design-system/stories/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../components';
import { FiPlus, FiSave, FiTrash2, FiArrowRight } from 'react-icons/fi';

const meta: Meta<typeof Button> = {
    title: 'Design System/Button',
    component: Button,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: 'select',
            options: ['primary', 'secondary', 'ghost', 'danger'],
        },
        size: {
            control: 'select',
            options: ['sm', 'md', 'lg'],
        },
        loading: { control: 'boolean' },
        disabled: { control: 'boolean' },
        fullWidth: { control: 'boolean' },
    },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
    args: {
        variant: 'primary',
        children: 'Primary Button',
    },
};

export const Secondary: Story = {
    args: {
        variant: 'secondary',
        children: 'Secondary Button',
    },
};

export const Ghost: Story = {
    args: {
        variant: 'ghost',
        children: 'Ghost Button',
    },
};

export const Danger: Story = {
    args: {
        variant: 'danger',
        children: 'Delete',
        leftIcon: <FiTrash2 />,
    },
};

export const WithLeftIcon: Story = {
    args: {
        variant: 'primary',
        children: 'Yeni Ekle',
        leftIcon: <FiPlus />,
    },
};

export const WithRightIcon: Story = {
    args: {
        variant: 'primary',
        children: 'Devam Et',
        rightIcon: <FiArrowRight />,
    },
};

export const Loading: Story = {
    args: {
        variant: 'primary',
        children: 'Kaydediliyor',
        loading: true,
    },
};

export const Disabled: Story = {
    args: {
        variant: 'primary',
        children: 'Disabled',
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
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Button variant="primary" leftIcon={<FiSave />}>Kaydet</Button>
                <Button variant="secondary" leftIcon={<FiPlus />}>Ekle</Button>
                <Button variant="danger" leftIcon={<FiTrash2 />}>Sil</Button>
            </div>
        </div>
    ),
};

export const FullWidth: Story = {
    args: {
        variant: 'primary',
        children: 'Full Width Button',
        fullWidth: true,
    },
    decorators: [
        (Story) => (
            <div style={{ width: '300px' }}>
                <Story />
            </div>
        ),
    ],
};
