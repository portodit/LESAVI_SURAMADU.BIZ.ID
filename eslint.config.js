/* eslint-env node */
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist*/**",
      "**/apps/api/dist*/**",
      "**/apps/dashboard/dist*/**",
    ],
  },
  {
    rules: {
      "no-unused-vars": "off",
      "no-console": "off",
    },
  },
];
