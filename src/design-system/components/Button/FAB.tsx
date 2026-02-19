import React from 'react';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import { clsx } from 'clsx';
import './FAB.css';

interface FABProps extends Omit<HTMLMotionProps<"button">, "children"> {
    icon: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

export const FAB: React.FC<FABProps> = ({ icon, className, onClick, ...props }) => {
    return (
        <motion.button
            className={clsx('ds-fab', className)}
            onClick={onClick}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            {...props}
        >
            {icon}
        </motion.button>
    );
};

export default FAB;
