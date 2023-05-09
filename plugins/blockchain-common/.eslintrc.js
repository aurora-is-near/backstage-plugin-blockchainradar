module.exports = require('@backstage/cli/config/eslint-factory')(__dirname, {
  rules: {
    'no-restricted-imports': 'off',
    'no-param-reassign': 'off',
    radix: 'off',
  },
});
