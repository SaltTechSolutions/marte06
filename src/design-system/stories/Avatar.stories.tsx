// src/design-system/stories/Avatar.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar, AvatarGroup } from '../components';

const meta: Meta<typeof Avatar> = {
    title: 'Design System/Avatar',
    component: Avatar,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    argTypes: {
        size: {
            control: 'select',
            options: ['xs', 'sm', 'md', 'lg', 'xl'],
        },
    },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithInitials: Story = {
    args: {
        name: 'Ahmet Yılmaz',
        size: 'md',
    },
};

export const WithImage: Story = {
    args: {
        name: 'Ayşe Demir',
        src: 'https://i.pravatar.cc/150?img=1',
        size: 'md',
    },
};

export const Sizes: Story = {
    render: () => (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Avatar name="XS Size" size="xs" />
            <Avatar name="SM Size" size="sm" />
            <Avatar name="MD Size" size="md" />
            <Avatar name="LG Size" size="lg" />
            <Avatar name="XL Size" size="xl" />
        </div>
    ),
};

export const DifferentNames: Story = {
    render: () => (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Avatar name="Ahmet Yılmaz" />
            <Avatar name="Mehmet Kaya" />
            <Avatar name="Ayşe Demir" />
            <Avatar name="Fatma Özkan" />
            <Avatar name="Ali Çelik" />
            <Avatar name="Zeynep Arslan" />
            <Avatar name="Mustafa Şahin" />
            <Avatar name="Elif Yıldız" />
        </div>
    ),
};

export const Group: Story = {
    render: () => (
        <AvatarGroup max={4}>
            <Avatar name="Ahmet Yılmaz" />
            <Avatar name="Mehmet Kaya" />
            <Avatar name="Ayşe Demir" />
            <Avatar name="Fatma Özkan" />
            <Avatar name="Ali Çelik" />
            <Avatar name="Zeynep Arslan" />
        </AvatarGroup>
    ),
};

export const GroupWithImages: Story = {
    render: () => (
        <AvatarGroup max={3} size="lg">
            <Avatar name="User 1" src="https://i.pravatar.cc/150?img=1" />
            <Avatar name="User 2" src="https://i.pravatar.cc/150?img=2" />
            <Avatar name="User 3" src="https://i.pravatar.cc/150?img=3" />
            <Avatar name="User 4" src="https://i.pravatar.cc/150?img=4" />
            <Avatar name="User 5" src="https://i.pravatar.cc/150?img=5" />
        </AvatarGroup>
    ),
};
