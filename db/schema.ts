import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
});

export const validationJobs = pgTable("validation_jobs", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  totalEmails: integer("total_emails").notNull(),
  processedEmails: integer("processed_emails").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  error: text("error"),
  metadata: jsonb("metadata"), // Additional job metadata
});

export const validationResults = pgTable("validation_results", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => validationJobs.id),
  email: text("email").notNull(),
  isValid: boolean("is_valid").notNull(),
  status: text("status").notNull(),
  message: text("message"),
  domain: text("domain"),
  mxRecord: text("mx_record"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Schema types and validation
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;

export const insertValidationJobSchema = createInsertSchema(validationJobs);
export const selectValidationJobSchema = createSelectSchema(validationJobs);
export type InsertValidationJob = typeof validationJobs.$inferInsert;
export type SelectValidationJob = typeof validationJobs.$inferSelect;

export const insertValidationResultSchema = createInsertSchema(validationResults);
export const selectValidationResultSchema = createSelectSchema(validationResults);
export type InsertValidationResult = typeof validationResults.$inferInsert;
export type SelectValidationResult = typeof validationResults.$inferSelect;