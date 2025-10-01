// Calendar Theme Constants
export const CALENDAR_THEME = {
  // Gradient backgrounds
  gradients: {
    primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    day: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    week: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
    month: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
    birthday: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    expiring: 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)',
    button: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
  },

  // Colors
  colors: {
    primary: '#667eea',
    secondary: '#764ba2',
    white: '#ffffff',
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
    },
    purple: {
      50: 'rgba(102, 126, 234, 0.05)',
      100: 'rgba(102, 126, 234, 0.1)',
      200: 'rgba(102, 126, 234, 0.2)',
      500: '#667eea',
    },
    amber: {
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
    },
    red: {
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
    },
  },

  // Glass morphism effects
  glass: {
    light: 'rgba(255, 255, 255, 0.95)',
    medium: 'rgba(255, 255, 255, 0.15)',
    dark: 'rgba(0, 0, 0, 0.5)',
  },

  // Shadows
  shadows: {
    sm: '0 4px 12px rgba(0, 0, 0, 0.15)',
    md: '0 8px 32px rgba(0, 0, 0, 0.1)',
    lg: '0 20px 60px rgba(0, 0, 0, 0.15)',
    button: '0 4px 16px rgba(255, 255, 255, 0.3)',
    card: '0 4px 12px rgba(102, 126, 234, 0.4)',
  },

  // Border radius
  radius: {
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    '2xl': '2rem',
    '3xl': '3rem',
  },
} as const;

// Reusable style objects
export const CALENDAR_STYLES = {
  // Header styles
  header: {
    container: {
      background: CALENDAR_THEME.glass.medium,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      boxShadow: CALENDAR_THEME.shadows.md,
    },
    logo: {
      background: CALENDAR_THEME.gradients.primary,
      boxShadow: '0 8px 16px rgba(102, 126, 234, 0.4)',
    },
  },

  // Navigation styles
  navigation: {
    container: {
      background: CALENDAR_THEME.glass.medium,
      boxShadow: CALENDAR_THEME.shadows.md,
    },
    button: {
      background: 'rgba(255, 255, 255, 0.2)',
      backdropFilter: 'blur(10px)',
      minWidth: '50px',
    },
    todayButton: {
      background: CALENDAR_THEME.gradients.button,
      color: CALENDAR_THEME.colors.primary,
      boxShadow: CALENDAR_THEME.shadows.button,
      minWidth: '50px',
    },
  },

  // View mode pills
  viewModePill: {
    container: {
      background: CALENDAR_THEME.glass.medium,
    },
    active: {
      background: 'rgba(255, 255, 255, 0.95)',
      color: CALENDAR_THEME.colors.primary,
      boxShadow: CALENDAR_THEME.shadows.sm,
      transform: 'scale(1.05)',
    },
    inactive: {
      background: 'transparent',
      color: 'rgba(255, 255, 255, 0.8)',
      boxShadow: 'none',
      transform: 'scale(1)',
    },
  },

  // Card styles
  card: {
    main: {
      background: CALENDAR_THEME.glass.light,
      boxShadow: CALENDAR_THEME.shadows.lg,
    },
    decorativeCircle: {
      large: {
        background: 'rgba(255, 255, 255, 0.1)',
      },
      small: {
        background: 'rgba(255, 255, 255, 0.08)',
      },
    },
  },

  // Time slot styles
  timeSlot: {
    container: {
      background: 'rgba(102, 126, 234, 0.03)',
    },
    empty: {
      background: 'rgba(102, 126, 234, 0.05)',
      border: '2px dashed rgba(102, 126, 234, 0.2)',
    },
  },

  // Birthday card
  birthday: {
    container: {
      background: CALENDAR_THEME.gradients.birthday,
    },
    item: {
      background: 'rgba(255, 255, 255, 0.6)',
      backdropFilter: 'blur(4px)',
    },
  },

  // Expiring package card
  expiring: {
    container: {
      background: CALENDAR_THEME.gradients.expiring,
    },
    item: {
      background: 'rgba(255, 255, 255, 0.6)',
      backdropFilter: 'blur(4px)',
    },
  },

  // Modal styles
  modal: {
    backdrop: {
      background: CALENDAR_THEME.glass.dark,
    },
    container: {
      background: 'rgba(255, 255, 255, 0.98)',
      maxHeight: '90vh',
      overflowY: 'auto' as const,
    },
    header: {
      background: CALENDAR_THEME.gradients.primary,
    },
    closeButton: {
      background: 'rgba(255, 255, 255, 0.2)',
    },
    participantCard: {
      absent: {
        background: 'rgba(239, 68, 68, 0.05)',
        border: '2px solid rgba(239, 68, 68, 0.2)',
      },
      present: {
        background: 'rgba(102, 126, 234, 0.05)',
        border: '2px solid rgba(102, 126, 234, 0.2)',
      },
    },
    walkInSection: {
      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
    },
    addButton: {
      active: {
        background: CALENDAR_THEME.gradients.primary,
        boxShadow: CALENDAR_THEME.shadows.card,
      },
      disabled: {
        background: '#d1d5db',
        boxShadow: 'none',
      },
    },
  },

  // Week view specific
  week: {
    headerCell: {
      today: {
        background: CALENDAR_THEME.gradients.week,
        color: 'white',
      },
      normal: {
        background: 'rgba(255, 255, 255, 0.8)',
        color: CALENDAR_THEME.colors.gray[600],
      },
    },
    timeLabel: {
      background: 'rgba(167, 139, 250, 0.1)',
    },
    cell: {
      today: {
        background: 'rgba(167, 139, 250, 0.08)',
      },
      normal: {
        background: 'rgba(167, 139, 250, 0.03)',
      },
    },
  },

  // Month view specific
  month: {
    headerCell: {
      weekend: {
        background: 'rgba(239, 68, 68, 0.1)',
        color: '#dc2626',
      },
      weekday: {
        background: 'rgba(16, 185, 129, 0.1)',
        color: '#059669',
      },
    },
    dayCell: {
      today: {
        background: CALENDAR_THEME.gradients.month,
        border: '2px solid rgba(16, 185, 129, 0.5)',
      },
      weekend: {
        background: 'rgba(239, 68, 68, 0.05)',
      },
      weekday: {
        background: 'rgba(16, 185, 129, 0.05)',
      },
      outOfMonth: {
        background: 'rgba(156, 163, 175, 0.05)',
        opacity: 0.5,
      },
    },
    lessonBadge: {
      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.8) 0%, rgba(20, 184, 166, 0.8) 100%)',
      color: 'white',
    },
  },
} as const;

// Utility function to merge styles
export const mergeStyles = (...styles: React.CSSProperties[]): React.CSSProperties => {
  return Object.assign({}, ...styles);
};
