import bcrypt from 'bcrypt';
import { db } from './db.js';

async function seed() {
  await db.transaction(async (trx) => {
    await trx.raw(
      'truncate teachers, classroom_profiles, plans, blocks, activities, annotations, resources, resource_links',
    );

    const [teacher] = await trx('teachers')
      .insert({
        email: 'demo@example.com',
        password_hash: await bcrypt.hash('password', 10),
      })
      .returning('id');

    const [defaultProfile] = await trx('classroom_profiles')
      .insert([
        {
          teacher_id: teacher.id,
          name: 'First Grade 2026',
          is_default: true,
          student_notes: JSON.stringify([
            {
              label: 'Reading Group Differentiation',
              note: 'The 3rd reading group gets a buddy for their independent reading',
            },
            {
              label: 'Purple Math Group',
              note: 'They need math manipulatives for problem of the day',
            },
          ]),
        },
        {
          teacher_id: teacher.id,
          name: 'After School Program',
          is_default: false,
        },
      ])
      .returning('id');

    const [mathResource, timerResource] = await trx('resources')
      .insert([
        {
          teacher_id: teacher.id,
          title: 'Math Videos',
          url: 'https://youtu.be/ErCIgERRC28?si=gKGf_vpbXb4lDsiw',
        },
        {
          teacher_id: teacher.id,
          title: 'Timers',
          url: 'https://www.online-stopwatch.com/classroom-timers/',
        },
      ])
      .returning('id');

    const [plan1] = await trx('plans')
      .insert([
        {
          teacher_id: teacher.id,
          profile_id: defaultProfile.id,
          title: 'Monday Lesson Plan',
          date: '2026-10-19',
          today_note:
            "Parent teacher conference with Sally's dad after school.",
        },
        {
          teacher_id: teacher.id,
          profile_id: defaultProfile.id,
          title: 'Sub Lesson Plan',
          date: '2026-10-17',
          is_template: true,
        },
      ])
      .returning('id');
    const [mathBlock] = await trx('blocks')
      .insert([
        {
          plan_id: plan1.id,
          title: 'Math',
          description: 'Goal: Add numbers up to 20.',
          start_minutes: 600,
          end_minutes: 650,
        },
        {
          plan_id: plan1.id,
          title: 'Writing',
          description: 'Goal: Write in past tense.',
          start_minutes: 720,
          end_minutes: 780,
        },
        {
          plan_id: plan1.id,
          title: 'After School',
          description:
            'Support with homework and prep activity for early finishers',
          start_minutes: 900,
          end_minutes: 1030,
        },
      ])
      .returning('id');

    const [, , mathExitTicket] = await trx('activities')
      .insert([
        {
          block_id: mathBlock.id,
          label: 'Small group instruction',
          steps: JSON.stringify([
            {
              text: 'Read the Task Statement: foo bar bux baz dkgnrtdfnlrkb  ...',
            },
            {
              text: 'Students learn that a teen number is not just a random count, but a set of 10 and a separate set of extra o...',
            },
            {
              text: 'Students use cards where a single-digit number hides the zero of the 10 card to show how (10) and (4) snap toget....',
            },
            {
              text: 'Students draw a full 5-group or 10-frame (10 dots) and then draw the extra ones beside or below it to visually prove the addition senten...',
            },
          ]),
          minutes: 20,
          position: 1,
        },
        {
          block_id: mathBlock.id,
          label: 'Group Activity',
          steps: JSON.stringify([
            {
              text: 'Goal: get a pile of cubes (teen number amount) and build using groups of 10s and ones and write number sentence: 10 + _ = ...',
            },
            {
              text: 'Build the teen number with concrete objects like Unifix cubes or beans.',
            },
            {
              text: 'Transfer the physical objects into a pictorial 10-frame or 5-group drawing.',
            },
            { text: 'Write the matching addition number sentence.' },
            {
              text: 'Discussing patterns, such as how adding 1 more to a teen number changes only the one ...',
            },
          ]),
          minutes: 15,
          position: 2,
        },
        {
          block_id: mathBlock.id,
          label: 'Exit Ticket',
          steps: JSON.stringify([
            {
              text: 'Goal: use numberbond to break apart a teen number into tens and ones ...',
            },
            {
              text: 'Display a single question on a screen while students write the answer on a small scrap or sticky note.',
            },
            {
              text: 'Taking a picture of a ten-rod and single unit cubes to identify or write the total.',
            },
          ]),
          position: 3,
        },
      ])
      .returning('id');

    await trx('annotations').insert([
      {
        block_id: mathBlock.id,
        type: 'good_to_know',
        text: 'Other strategies for working with teen numbers: count on, draw it out, numberbond',
      },
      {
        block_id: mathBlock.id,
        activity_id: mathExitTicket.id,
        type: 'if_time',
        text: 'Done Early: help organize cubes into groups of ten',
      },
    ]);

    await trx('resource_links').insert([
      {
        resource_id: mathResource.id,
        block_id: mathBlock.id,
      },
      {
        resource_id: timerResource.id,
        plan_id: plan1.id,
      },
    ]);
  });
}

seed()
  .then(() => console.log('Seeded. Log in as demo@example.com / password'))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
