module.exports = {
    env: {
        node: true,
        es2022: true,
        jest: true
    },
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
    },
    extends: ['eslint:recommended'],
    rules: {
        // Error prevention
        'no-unused-vars': [
            'error',
            { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }
        ],
        'no-console': ['warn', { allow: ['warn', 'error'] }],
        'no-debugger': 'error',
        'no-duplicate-imports': 'error',

        // Best practices
        eqeqeq: ['error', 'always'],
        curly: ['error', 'all'],
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-new-func': 'error',
        'no-return-await': 'error',
        'require-await': 'error',
        'no-throw-literal': 'error',

        // Style (minimal - let editor config handle formatting)
        semi: ['error', 'always'],
        quotes: ['error', 'single', { avoidEscape: true }],
        'comma-dangle': ['error', 'never'],
        'no-trailing-spaces': 'error',
        'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],

        // Node.js specific
        'no-process-exit': 'off', // We need process.exit for graceful shutdown
        'callback-return': 'error',
        'handle-callback-err': 'error'
    },
    overrides: [
        {
            // Test files have different rules
            files: ['**/__tests__/**/*.js', '**/*.test.js', '**/*.spec.js'],
            rules: {
                'no-console': 'off',
                'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
            }
        }
    ],
    ignorePatterns: ['node_modules/', 'coverage/', 'logs/', '*.min.js']
};
