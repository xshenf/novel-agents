import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // scripts 目录为测试脚本，放宽 any 限制
  {
    files: ["scripts/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // lib/agent 目录与 LangChain 深度耦合，放宽 any 限制
  {
    files: ["lib/agent/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // lib/ 与 Prisma/LangChain 深度耦合，any 限制降为警告
  {
    files: ["lib/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // app/hooks 与 app/api 同样涉及 Prisma/LangChain 类型，降为警告
  {
    files: ["app/hooks/**", "app/api/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // React 编译器规则：refs 写入和 effect 内 setState 是现有代码的常见模式，降为警告
  {
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
