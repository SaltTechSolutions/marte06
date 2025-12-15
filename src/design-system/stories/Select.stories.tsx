import type { Meta, StoryObj } from '@storybook/react';
import { Select } from '../components/Select/Select';

const meta = {
    title: 'Design System/Primitive/Select',
    component: Select,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    argTypes: {
        size: {
            control: 'select',
            options: ['sm', 'md', 'lg'],
        },
        error: {
            control: 'text',
        },
        hint: {
            control: 'text',
        },
        fullWidth: {
            control: 'boolean',
        },
        disabled: {
            control: 'boolean',
        },
    },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

const options = [
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' },
    { value: '3', label: 'Option 3' },
];

export const Default: Story = {
    args: {
        label: 'Select Option',
        placeholder: 'Choose one...',
        options: options,
    },
};

export const WithError: Story = {
    args: {
        label: 'Select Option',
        placeholder: 'Choose one...',
        options: options,
        error: 'This field is required',
    },
};

export const WithHint: Story = {
    args: {
        label: 'Select Option',
        placeholder: 'Choose one...',
        options: options,
        hint: 'Please select the best option',
    },
};

export const FullWidth: Story = {
    args: {
        label: 'Select Option',
        placeholder: 'Choose one...',
        options: options,
        fullWidth: true,
    },
    parameters: {
        layout: 'padded',
    }
};

export const Disabled: Story = {
    args: {
        label: 'Select Option',
        placeholder: 'Choose one...',
        options: options,
        disabled: true,
    },
};
