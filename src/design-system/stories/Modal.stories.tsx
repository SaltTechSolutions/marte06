import type { Meta, StoryObj } from '@storybook/react';
import { Modal, ModalFooter } from '../components/Modal/Modal';
import { Button } from '../components/Button/Button';
import { useState } from 'react';

const meta = {
    title: 'Design System/Primitive/Modal',
    component: Modal,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    argTypes: {
        size: {
            control: 'select',
            options: ['sm', 'md', 'lg', 'xl', 'full'],
        },
        isOpen: {
            control: 'boolean',
        }
    },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

// Wrapper component to handle state
const ModalWrapper = (args: any) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div>
            <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
            <Modal {...args} isOpen={isOpen} onClose={() => setIsOpen(false)}>
                <p>This is the modal content. It can contain any elements.</p>
                <ModalFooter>
                    <Button variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button variant="primary" onClick={() => setIsOpen(false)}>Confirm</Button>
                </ModalFooter>
            </Modal>
        </div>
    );
};

export const Default: Story = {
    render: (args) => <ModalWrapper {...args} />,
    args: {
        title: 'Modal Title',
        size: 'md',
        isOpen: false,
        onClose: () => { },
        children: 'Content'
    }
};

export const Small: Story = {
    render: (args) => <ModalWrapper {...args} />,
    args: {
        title: 'Small Modal',
        size: 'sm',
        isOpen: false,
        onClose: () => { },
        children: 'Content'
    }
};

export const Large: Story = {
    render: (args) => <ModalWrapper {...args} />,
    args: {
        title: 'Large Modal',
        size: 'lg',
        isOpen: false,
        onClose: () => { },
        children: 'Content'
    }
};
