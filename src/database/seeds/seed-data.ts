import { Role } from '../../users/role.enum';

export interface SeedArea {
  name: string;
  description: string;
}

export interface SeedStudent {
  firstName: string;
  lastName: string;
  email: string;
  gradeLevel: string;
  // Scores per area name, in period order: the first one is period 1.
  scores: Record<string, number[]>;
}

export interface SeedUser {
  email: string;
  password: string;
  role: Role.TEACHER | Role.STUDENT;
  // Email of the seeded student that a STUDENT user is linked to.
  studentEmail?: string;
}

export const SEED_AREAS: SeedArea[] = [
  { name: 'Matemáticas', description: 'Álgebra, geometría y estadística' },
  {
    name: 'Lenguaje',
    description: 'Comprensión lectora, gramática y producción de textos',
  },
  { name: 'Ciencias Naturales', description: 'Biología, química y física' },
  {
    name: 'Ciencias Sociales',
    description: 'Historia, geografía y competencias ciudadanas',
  },
  { name: 'Inglés', description: 'Lectura, escritura, escucha y conversación' },
];

// Each student shows a different case of the recommendations engine.
export const SEED_STUDENTS: SeedStudent[] = [
  {
    // Improving in Matemáticas, superior in Inglés.
    firstName: 'Laura',
    lastName: 'Gómez',
    email: 'laura.gomez@colegio.edu.co',
    gradeLevel: '9A',
    scores: {
      Matemáticas: [2.4, 2.9, 3.4, 3.8],
      Lenguaje: [3.8, 4.0, 3.9, 4.1],
      Inglés: [4.6, 4.8, 4.7, 4.9],
    },
  },
  {
    // Declining in Ciencias Naturales.
    firstName: 'Santiago',
    lastName: 'Rodríguez',
    email: 'santiago.rodriguez@colegio.edu.co',
    gradeLevel: '9A',
    scores: {
      'Ciencias Naturales': [4.4, 4.0, 3.4, 3.0],
      Matemáticas: [3.5, 3.4, 3.6, 3.5],
      'Ciencias Sociales': [4.2, 4.3, 4.1, 4.4],
    },
  },
  {
    // Superior in every area.
    firstName: 'Valentina',
    lastName: 'Martínez',
    email: 'valentina.martinez@colegio.edu.co',
    gradeLevel: '10B',
    scores: {
      Matemáticas: [4.8, 4.9, 4.7, 5.0],
      'Ciencias Naturales': [4.7, 4.8, 4.9, 4.8],
      Inglés: [4.9, 5.0, 4.8, 4.9],
    },
  },
  {
    // Failing Inglés and irregular in Ciencias Sociales.
    firstName: 'Mateo',
    lastName: 'López',
    email: 'mateo.lopez@colegio.edu.co',
    gradeLevel: '10B',
    scores: {
      Inglés: [2.5, 2.7, 2.4, 2.6],
      'Ciencias Sociales': [1.8, 4.5, 2.2, 4.0],
      Lenguaje: [3.0, 3.2],
    },
  },
  {
    // No grades yet.
    firstName: 'Isabella',
    lastName: 'Torres',
    email: 'isabella.torres@colegio.edu.co',
    gradeLevel: '11A',
    scores: {},
  },
];

// Demo accounts for development only: their passwords are public in this repo.
export const SEED_USERS: SeedUser[] = [
  {
    email: 'docente@colegio.edu.co',
    password: 'Docente123',
    role: Role.TEACHER,
  },
  {
    email: 'laura.gomez@colegio.edu.co',
    password: 'Estudiante123',
    role: Role.STUDENT,
    studentEmail: 'laura.gomez@colegio.edu.co',
  },
  {
    email: 'santiago.rodriguez@colegio.edu.co',
    password: 'Estudiante123',
    role: Role.STUDENT,
    studentEmail: 'santiago.rodriguez@colegio.edu.co',
  },
];
