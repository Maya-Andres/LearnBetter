import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateAreaDto } from '../../areas/dto/create-area.dto';
import { CreateGradeDto } from '../../grades/dto/create-grade.dto';
import { MAX_PERIOD } from '../../grades/grade-scale';
import { CreateStudentDto } from '../../students/dto/create-student.dto';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { Role } from '../../users/role.enum';
import { SEED_AREAS, SEED_STUDENTS, SEED_USERS } from './seed-data';

const SOME_ID = '3f6c1d2a-8b4e-4c1a-9f2d-1a2b3c4d5e6f';

// The seed writes straight to the database, so it is checked against the same rules as the API.
function validationErrors(dto: new () => object, data: object): string[] {
  return validateSync(plainToInstance(dto, data), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).flatMap((error) => Object.values(error.constraints ?? {}));
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

describe('Seed data', () => {
  it('las materias son validas y sus nombres no se repiten', () => {
    for (const area of SEED_AREAS) {
      expect(validationErrors(CreateAreaDto, area)).toEqual([]);
    }
    expect(
      hasDuplicates(SEED_AREAS.map((area) => area.name.toLowerCase())),
    ).toBe(false);
  });

  it('los estudiantes son validos y sus correos no se repiten', () => {
    for (const { scores: _scores, ...student } of SEED_STUDENTS) {
      expect(validationErrors(CreateStudentDto, student)).toEqual([]);
    }
    expect(hasDuplicates(SEED_STUDENTS.map((student) => student.email))).toBe(
      false,
    );
  });

  it('cada nota es valida y pertenece a una materia del seed', () => {
    const areaNames = SEED_AREAS.map((area) => area.name);

    for (const student of SEED_STUDENTS) {
      for (const [areaName, scores] of Object.entries(student.scores)) {
        expect(areaNames).toContain(areaName);
        expect(scores.length).toBeLessThanOrEqual(MAX_PERIOD);
        scores.forEach((score, index) => {
          const grade = {
            studentId: SOME_ID,
            areaId: SOME_ID,
            score,
            period: index + 1,
          };
          expect(validationErrors(CreateGradeDto, grade)).toEqual([]);
        });
      }
    }
  });

  it('los usuarios son validos y cada STUDENT queda enlazado a un estudiante distinto', () => {
    const studentEmails = SEED_STUDENTS.map((student) => student.email);

    for (const { studentEmail, ...user } of SEED_USERS) {
      const studentId =
        studentEmail === undefined ? {} : { studentId: SOME_ID };
      expect(
        validationErrors(CreateUserDto, { ...user, ...studentId }),
      ).toEqual([]);

      if (user.role === Role.STUDENT) {
        expect(studentEmails).toContain(studentEmail);
      } else {
        expect(studentEmail).toBeUndefined();
      }
    }

    expect(hasDuplicates(SEED_USERS.map((user) => user.email))).toBe(false);
    const linkedStudents = SEED_USERS.flatMap((user) =>
      user.studentEmail === undefined ? [] : [user.studentEmail],
    );
    expect(hasDuplicates(linkedStudents)).toBe(false);
  });
});
