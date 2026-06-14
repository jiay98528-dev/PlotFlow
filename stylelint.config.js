module.exports = {
  extends: ['stylelint-config-standard'],
  rules: {
    'color-no-hex': true,
    'declaration-no-important': true,
    'selector-max-id': 0,
    'selector-class-pattern': [
      '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:(?:__|--)[a-z0-9]+(?:-[a-z0-9]+)*)?$',
      {
        message: 'Class selector must use kebab-case or BEM style',
      },
    ],
    'number-max-precision': 4,
    'custom-property-pattern': [
      '^(color|space|radius|shadow|font|motion|z|text|ease)-[a-z0-9]+(-[a-z0-9]+)*$',
      {
        message: 'Custom property must follow --<category>-<role>-<variant> pattern',
      },
    ],
  },
  overrides: [
    {
      files: ['**/tokens.css', '**/tokens-*.css'],
      rules: {
        'alpha-value-notation': null,
        'color-function-notation': null,
        'color-hex-length': null,
        'color-no-hex': null,
        'custom-property-empty-line-before': null,
      },
    },
    {
      files: ['**/branch-graph.css'],
      rules: {
        'declaration-no-important': null,
      },
    },
  ],
};
