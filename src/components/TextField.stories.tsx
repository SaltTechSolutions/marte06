// src/components/TextField.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextField } from '../newUI/primitives';
import { useState } from 'react';

const meta: Meta<typeof TextField> = {
    title: 'Primitives/TextField',
    component: TextField,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    argTypes: {
        label: {
            control: 'text',
            description: 'Field label',
        },
        placeholder: {
            control: 'text',
            description: 'Placeholder text',
        },
        description: {
            control: 'text',
            description: 'Helper description text',
        },
        message: {
            control: 'text',
            description: 'Validation message',
        },
        invalid: {
            control: 'boolean',
            description: 'Invalid state',
        },
        required: {
            control: 'boolean',
            description: 'Required field indicator',
        },
        disabled: {
            control: 'boolean',
            description: 'Disabled state',
        },
        type: {
            control: 'select',
            options: ['text', 'email', 'password', 'tel', 'number', 'date'],
            description: 'Input type',
        },
    },
    decorators: [
        (Story) => (
            <div style={{ width: '300px' }}>
                <Story />
            </div>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        label: 'İsim',
        placeholder: 'Adınızı giriniz',
    },
};

export const WithDescription: Story = {
    args: {
        label: 'E-posta',
        placeholder: 'ornek@email.com',
        description: 'Giriş için kullanılacak e-posta adresi',
        type: 'email',
    },
};

export const Required: Story = {
    args: {
        label: 'Telefon',
        placeholder: '05XX XXX XX XX',
        required: true,
        type: 'tel',
    },
};

export const WithError: Story = {
    args: {
        label: 'E-posta',
        defaultValue: 'invalid-email',
        message: 'Geçerli bir e-posta adresi giriniz.',
        invalid: true,
        type: 'email',
    },
};

export const Disabled: Story = {
    args: {
        label: 'Üye ID',
        defaultValue: 'M-12345',
        disabled: true,
    },
};

export const Password: Story = {
    args: {
        label: 'Şifre',
        placeholder: '********',
        type: 'password',
    },
};

export const Date: Story = {
    args: {
        label: 'Doğum Tarihi',
        type: 'date',
    },
};

export const Number: Story = {
    args: {
        label: 'Ders Sayısı',
        placeholder: '0',
        type: 'number',
    },
};

// Interactive example with state
const ControlledTextField = () => {
    const [value, setValue] = useState('');
    const [invalid, setInvalid] = useState(false);
    const [message, setMessage] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setValue(e.target.value);
        if (e.target.value.length < 3) {
            setInvalid(true);
            setMessage('En az 3 karakter olmalıdır.');
        } else {
            setInvalid(false);
            setMessage('');
        }
    };

    return (
        <TextField
            label="Kontrollü Input"
            value={value}
            onChange={handleChange}
            invalid={invalid}
            message={message || undefined}
            placeholder="En az 3 karakter giriniz"
            description={`${value.length} karakter`}
        />
    );
};

export const Controlled: Story = {
    render: () => <ControlledTextField />,
};

export const AllStates: Story = {
    render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '300px' }}>
            <TextField label="Normal" placeholder="Normal input" />
            <TextField label="Zorunlu" placeholder="Zorunlu alan" required />
            <TextField label="Açıklamalı" placeholder="Input" description="Yardımcı açıklama metni" />
            <TextField label="Hatalı" defaultValue="Hatalı değer" message="Bu alan geçersiz." invalid />
            <TextField label="Devre Dışı" defaultValue="Salt okunur" disabled />
        </div>
    ),
};
