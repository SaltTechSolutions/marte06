// src/design-system/stories/Input.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from '../components';
import { FiMail, FiLock, FiSearch, FiEye, FiEyeOff } from 'react-icons/fi';
import { useState } from 'react';

const meta: Meta<typeof Input> = {
    title: 'Design System/Input',
    component: Input,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    argTypes: {
        size: {
            control: 'select',
            options: ['sm', 'md', 'lg'],
        },
        disabled: { control: 'boolean' },
        required: { control: 'boolean' },
    },
    decorators: [
        (Story) => (
            <div style={{ width: '320px' }}>
                <Story />
            </div>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        label: 'Ad Soyad',
        placeholder: 'Adınızı giriniz',
    },
};

export const WithHint: Story = {
    args: {
        label: 'E-posta',
        placeholder: 'ornek@email.com',
        hint: 'Giriş için kullanılacak e-posta',
        type: 'email',
    },
};

export const WithError: Story = {
    args: {
        label: 'E-posta',
        defaultValue: 'invalid',
        error: 'Geçerli bir e-posta adresi giriniz.',
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

export const WithLeftIcon: Story = {
    args: {
        label: 'E-posta',
        placeholder: 'ornek@email.com',
        leftIcon: <FiMail size={18} />,
        type: 'email',
    },
};

export const SearchInput: Story = {
    args: {
        placeholder: 'Üye ara...',
        leftIcon: <FiSearch size={18} />,
    },
};

// Password input with toggle
const PasswordInput = () => {
    const [show, setShow] = useState(false);
    return (
        <Input
            label="Şifre"
            type={show ? 'text' : 'password'}
            placeholder="********"
            leftIcon={<FiLock size={18} />}
            rightIcon={
                <button
                    type="button"
                    onClick={() => setShow(!show)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
                >
                    {show ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
            }
        />
    );
};

export const Password: Story = {
    render: () => <PasswordInput />,
};

export const Disabled: Story = {
    args: {
        label: 'Kullanıcı ID',
        defaultValue: 'USR-12345',
        disabled: true,
    },
};

export const Sizes: Story = {
    render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Input size="sm" placeholder="Small" />
            <Input size="md" placeholder="Medium (default)" />
            <Input size="lg" placeholder="Large" />
        </div>
    ),
};

export const AllStates: Story = {
    render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Input label="Normal" placeholder="Normal input" />
            <Input label="With Hint" placeholder="With hint" hint="Yardımcı metin" />
            <Input label="With Error" defaultValue="Hatalı değer" error="Bu alan geçersiz" />
            <Input label="Required" placeholder="Zorunlu alan" required />
            <Input label="Disabled" defaultValue="Salt okunur" disabled />
            <Input label="With Icon" placeholder="Arama..." leftIcon={<FiSearch size={18} />} />
        </div>
    ),
};
