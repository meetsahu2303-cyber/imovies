import mongoose from 'mongoose';
import { mkdtemp, rm } from 'node:fs/promises';
import { env, rootDir } from './env.js';
let memoryServer;
let memoryPath;
export async function connectDatabase({ memory = false } = {}) {
  let uri = env.MONGODB_URI;
  if (memory) {
    if (env.NODE_ENV === 'production')
      throw new Error('In-memory MongoDB cannot be used in production.');
    const { MongoMemoryReplSet } = await import('mongodb-memory-server');
    // A single-node replica set supports the same MongoDB transactions as Atlas.
    await import('node:fs/promises').then((fs) =>
      fs.mkdir(`${rootDir}/.cache`, { recursive: true }),
    );
    memoryPath = await mkdtemp(`${rootDir}/.cache/mongo-`);
    memoryServer = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
      instanceOpts: [
        {
          dbPath: memoryPath,
          args: ['--wiredTigerCacheSizeGB', '0.25'],
          launchTimeout: 60000,
        },
      ],
    });
    uri = memoryServer.getUri('imovies');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
    maxPoolSize: 20,
  });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && !hello.msg)
    throw new Error(
      'MongoDB must be a replica set (Atlas or local rs0) for atomic booking transactions.',
    );
  return mongoose.connection;
}
export async function disconnectDatabase() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = undefined;
  }
  if (memoryPath) {
    await rm(memoryPath, { recursive: true, force: true });
    memoryPath = undefined;
  }
}
