//require("dotenv").config({ path: __dirname + "/.env" });

// I don't fully understand the wider context of k8s service environment
// variables, but I know that these seem to get set in my IDE and that lets me
// connect to the database.
const connstringFromK8sServiceEnv = () => {
  const {
    POSTGRES_1_0_POSTGRES_SERVICE_HOST: DB_HOST,
    POSTGRES_1_0_POSTGRES_SERVICE_PORT: DB_PORT,
  } = process.env;

  if (DB_HOST && DB_PORT) {
    const { DB_PASS, DB_USER } = process.env;
    return `postgres://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}}/fk`;
  }

  return undefined;
};

const connstringFromEnv = () =>
  process.env.DATABASE_URL?.length ? process.env.DATABASE_URL : undefined;

const getConnstring = () => {
  const envConnstring = connstringFromEnv();

  if (envConnstring) return envConnstring;

  // If we are in production, we don't fall back to k8s env
  if (process.env.NODE_ENV === "production")
    throw new Error("DATABASE_URL is not set!");

  const k8sConnstring = connstringFromK8sServiceEnv();

  if (k8sConnstring) return k8sConnstring;

  throw new Error("Neither DATABASE_URL nor k8s service envs are set!");
};

module.exports = {
  test: {
    client: "pg",
    connection: process.env.DATABASE_TEST_URL,
  },
  development: {
    client: "pg",
    connection: getConnstring(),
  },
  production: {
    client: "pg",
    connection: getConnstring(),
  },
};
