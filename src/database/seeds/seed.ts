import { hash } from 'bcryptjs';
import { EntityManager } from 'typeorm';
import { Area } from '../../areas/entities/area.entity';
import { Grade } from '../../grades/entities/grade.entity';
import { Student } from '../../students/entities/student.entity';
import { User } from '../../users/entities/user.entity';
import {
  SEED_AREAS,
  SEED_STUDENTS,
  SEED_USERS,
  SeedArea,
  SeedStudent,
  SeedUser,
} from './seed-data';

// Same cost as UsersService, so seeded passwords behave like the ones from the API.
const BCRYPT_ROUNDS = 10;

export interface SeedSummary {
  areas: number;
  students: number;
  grades: number;
  users: number;
}

// Safe to run several times: whatever already exists is reused, never duplicated.
export async function seed(manager: EntityManager): Promise<SeedSummary> {
  const summary: SeedSummary = { areas: 0, students: 0, grades: 0, users: 0 };

  const areas = new Map<string, Area>();
  for (const data of SEED_AREAS) {
    areas.set(data.name, await findOrCreateArea(manager, data, summary));
  }

  const students = new Map<string, Student>();
  for (const data of SEED_STUDENTS) {
    students.set(
      data.email,
      await findOrCreateStudent(manager, data, areas, summary),
    );
  }

  for (const data of SEED_USERS) {
    await createUserIfMissing(manager, data, students, summary);
  }

  return summary;
}

async function findOrCreateArea(
  manager: EntityManager,
  data: SeedArea,
  summary: SeedSummary,
): Promise<Area> {
  // Same case-insensitive match as AreasService, so "matemáticas" counts as taken.
  const existing = await manager
    .createQueryBuilder(Area, 'area')
    .where('LOWER(TRIM(area.name)) = :name', {
      name: data.name.trim().toLowerCase(),
    })
    .getOne();
  if (existing) {
    return existing;
  }

  summary.areas++;
  return manager.save(manager.create(Area, data));
}

async function findOrCreateStudent(
  manager: EntityManager,
  data: SeedStudent,
  areas: Map<string, Area>,
  summary: SeedSummary,
): Promise<Student> {
  const existing = await manager.findOneBy(Student, { email: data.email });
  if (existing) {
    return existing;
  }

  const { scores, ...studentData } = data;
  const student = await manager.save(manager.create(Student, studentData));
  summary.students++;

  // Grades are only added with a new student, so running the seed again does not repeat them.
  const grades = Object.entries(scores).flatMap(([areaName, areaScores]) =>
    areaScores.map((score, index) =>
      manager.create(Grade, {
        studentId: student.id,
        areaId: areas.get(areaName)!.id,
        score,
        period: index + 1,
        description: `Evaluación del periodo ${index + 1}`,
      }),
    ),
  );
  await manager.save(grades);
  summary.grades += grades.length;

  return student;
}

async function createUserIfMissing(
  manager: EntityManager,
  data: SeedUser,
  students: Map<string, Student>,
  summary: SeedSummary,
): Promise<void> {
  const email = data.email.trim().toLowerCase();
  if (await manager.existsBy(User, { email })) {
    return;
  }

  const studentId =
    data.studentEmail === undefined
      ? null
      : students.get(data.studentEmail)!.id;
  // A student can only have one user: keep the one that is already linked.
  if (studentId !== null && (await manager.existsBy(User, { studentId }))) {
    return;
  }

  await manager.save(
    manager.create(User, {
      email,
      passwordHash: await hash(data.password, BCRYPT_ROUNDS),
      role: data.role,
      studentId,
    }),
  );
  summary.users++;
}
