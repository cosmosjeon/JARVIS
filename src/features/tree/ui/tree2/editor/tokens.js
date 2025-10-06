const memoEditorTokens = {
    typography: {
        body: { size: 16, lineHeight: 1.6 },
        h1: { size: 30, lineHeight: 1.3 },
        h2: { size: 24, lineHeight: 1.35 },
        h3: { size: 19, lineHeight: 1.4 },
    },
    spacing: { xs: 6, sm: 8, md: 12, lg: 16 },
    radius: { md: 10, lg: 12 },
    color: {
        text: { primary: '#1a1a1a', secondary: '#666666', hint: '#999999' },
        line: { muted: '#EDEEF0' },
        tint: {
            blue: '#E8F1FF',
            green: '#E9F8EE',
            yellow: '#FFF7D9',
            orange: '#FFEBDD',
            red: '#FFE6E6',
        },
    },
    shadow: { card: '0 8px 24px rgba(15, 23, 42, 0.08)' },
    focusRing: { style: '0 0 0 2px rgba(59, 130, 246, 0.45)' },
};

export default memoEditorTokens;
