import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('teachers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email').notNullable();
    table.string('password_hash').notNullable();
    table.timestamps(true, true);
  });

  await knex.raw(
    'create unique index teachers_email_lower_unique on teachers (lower(email))',
  );

  await knex.schema.createTable('classroom_profiles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('teacher_id')
      .notNullable()
      .references('id')
      .inTable('teachers')
      .onDelete('CASCADE');

    table.string('name').notNullable();
    table.boolean('is_default').notNullable().defaultTo(false);
    table.jsonb('school_info').notNullable().defaultTo('[]');
    table.jsonb('contacts').notNullable().defaultTo('[]');
    table.jsonb('classroom_notes').notNullable().defaultTo('[]');
    table.jsonb('student_notes').notNullable().defaultTo('[]');
    table.timestamp('archived_at', { useTz: true }).nullable();

    table.unique(['teacher_id'], {
      indexName: 'classroom_profiles_one_default',
      predicate: knex.whereRaw('is_default'),
    });
    table.unique(['id', 'teacher_id']);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('plans', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('teacher_id')
      .notNullable()
      .references('id')
      .inTable('teachers')
      .onDelete('CASCADE');
    table.uuid('profile_id').notNullable();
    table
      .foreign(['profile_id', 'teacher_id'])
      .references(['id', 'teacher_id'])
      .inTable('classroom_profiles');
    table.string('title').notNullable();
    table.date('date').nullable();
    table.boolean('is_template').notNullable().defaultTo(false);
    table.text('today_note').nullable();
    table.text('share_token').unique().nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('blocks', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('plan_id')
      .notNullable()
      .references('id')
      .inTable('plans')
      .onDelete('CASCADE');
    table
      .uuid('profile_id')
      .nullable()
      .references('id')
      .inTable('classroom_profiles')
      .onDelete('SET NULL');
    table.string('title').notNullable();
    table.integer('position').notNullable();
    table.integer('start_minutes').notNullable();
    table.integer('end_minutes').notNullable();

    table.check(
      'start_minutes >= 0 and end_minutes <= 1440 and end_minutes > start_minutes',
      [],
      'blocks_minutes_check',
    );
    table.timestamps(true, true);
  });

  await knex.schema.createTable('activities', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('block_id')
      .notNullable()
      .references('id')
      .inTable('blocks')
      .onDelete('CASCADE');
    table.text('label').notNullable();
    table.integer('minutes').nullable(); // null = flexible
    table.integer('position').notNullable();

    table.check(
      'minutes is null or minutes > 0',
      [],
      'activities_minutes_check',
    );
    table.timestamps(true, true);
  });

  await knex.schema.createTable('annotations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('block_id')
      .notNullable()
      .references('id')
      .inTable('blocks')
      .onDelete('CASCADE');
    table.string('type').notNullable();
    table.text('text').notNullable();

    table.check(
      "type in ('must_know', 'heads_up', 'good_to_know', 'if_time')",
      [],
      'annotations_type_check',
    );
    table.check("btrim(text) <> ''", [], 'annotations_text_not_empty_check');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('resources', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('teacher_id')
      .notNullable()
      .references('id')
      .inTable('teachers')
      .onDelete('CASCADE');
    table.string('title').notNullable();
    table.text('url').notNullable();

    table.unique(['teacher_id', 'url']);
    table.check("url ~* '^(http|https)://'", [], 'resources_url_http_check');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('resource_links', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('resource_id')
      .notNullable()
      .references('id')
      .inTable('resources')
      .onDelete('CASCADE');
    table
      .uuid('plan_id')
      .nullable()
      .references('id')
      .inTable('plans')
      .onDelete('CASCADE');
    table
      .uuid('block_id')
      .nullable()
      .references('id')
      .inTable('blocks')
      .onDelete('CASCADE');
    table.unique(['resource_id', 'plan_id']); // block duplicate attachments
    table.unique(['resource_id', 'block_id']); // block duplicate attachments
    table.check(
      'num_nonnulls(plan_id, block_id) = 1',
      [],
      'resource_links_one_target',
    );
    table.timestamps(true, true);
  });

  // connect-pg-simple's table.sql (v10.0.0); createTableIfMissing stays off
  await knex.raw(`
    CREATE TABLE "session" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    )
    WITH (OIDS=FALSE);

    ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

    CREATE INDEX "IDX_session_expire" ON "session" ("expire");
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('session');

  await knex.schema.dropTable('resource_links');
  await knex.schema.dropTable('resources');
  await knex.schema.dropTable('annotations');
  await knex.schema.dropTable('activities');
  await knex.schema.dropTable('blocks');
  await knex.schema.dropTable('plans');
  await knex.schema.dropTable('classroom_profiles');
  await knex.schema.dropTable('teachers');
}
