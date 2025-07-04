import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TestSetup } from '../utils/setup';
import { UserRepository } from '../../src/infrastructure/database/mysql/repositories/user.repository';
import { AnimalRepository } from '../../src/infrastructure/database/mysql/repositories/animal.repository';
import { AdoptionRepository } from '../../src/infrastructure/database/mysql/repositories/adoption.repository';
import { UserRole } from '../../src/core/domain/user/value-objects/user-role.enum';
import { UserStatus } from '../../src/core/domain/user/value-objects/user-status';
import { AnimalType } from '../../src/core/domain/animal/value-objects/animal-type.enum';
import { AnimalGender } from '../../src/core/domain/animal/value-objects/animal-gender.enum';
import { AdoptionType } from '../../src/core/domain/adoption/value-objects/adoption-type.enum';
import { AdoptionStatus } from '../../src/core/domain/adoption/value-objects/adoption-status.enum';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../../src/core/domain/user/user.entity';


describe('Adoption Integration Tests', () => {
  let app: INestApplication;
  let testSetup: TestSetup;
  let userRepository: UserRepository;
  let animalRepository: AnimalRepository;
  let adoptionRepository: AdoptionRepository;

  beforeAll(async () => {
    testSetup = new TestSetup();
    await testSetup.initialize();
    app = testSetup.app;
    userRepository = app.get<UserRepository>(UserRepository);
    animalRepository = app.get<AnimalRepository>(AnimalRepository);
    adoptionRepository = app.get<AdoptionRepository>(AdoptionRepository);
  });

  afterAll(async () => {
    await testSetup.cleanup();
  });

  beforeEach(async () => {
    await testSetup.clearDatabase();
  });

  async function createUserAndGetToken(userData: any) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const userEntity = new UserEntity(
      undefined!,
      userData.email,
      hashedPassword,
      userData.firstName,
      userData.lastName,
      userData.phone || userData.phoneNumber,
      userData.role,
      UserStatus.ACTIVE,
      true,
      userData.address,
      undefined,
      undefined,
      false,
      userData.dni || userData.identityDocument
    );

    const user = await userRepository.create(userEntity);

    const loginResponse = await request(testSetup.getHttpServer())
      .post('/auth/login')
      .send({
        email: userData.email,
        password: userData.password,
      });

    return {
      user,
      token: loginResponse.body.access_token,
    };
  }

  describe('Adoption Flow', () => {
    it('should allow users to request, approve, and complete an adoption', async () => {
      const ownerData = {
        email: 'owner@example.com',
        password: 'Password123!',
        firstName: 'Owner',
        lastName: 'User',
        phone: '923456789',
        role: UserRole.ADOPTER,
        address: 'Owner Address',
        dni: '87654321'
      };

      const adopterData = {
        email: 'adopter@example.com',
        password: 'Password123!',
        firstName: 'Adopter',
        lastName: 'User',
        phone: '987654321',
        role: UserRole.ADOPTER,
        address: 'Adopter Address',
        dni: '12345678'
      };

      const { user: owner, token: ownerToken } = await createUserAndGetToken(ownerData);
      const { user: adopter, token: adopterToken } = await createUserAndGetToken(adopterData);

      const animalData = {
        name: 'Fluffy',
        type: AnimalType.DOG,
        breed: 'Mixed',
        gender: AnimalGender.MALE,
        age: 2,
        description: 'A friendly dog looking for a new home',
        weight: 15,
        color: 'Brown',
        isVaccinated: true,
        isNeutered: true,
        healthDetails: 'Healthy and energetic',
        adoptionStatus: 'AVAILABLE',
        ownerId: owner.getId(),
      };

      const createAnimalResponse = await request(testSetup.getHttpServer())
        .post('/animals')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(animalData)
        .expect(201);

      const animalId = createAnimalResponse.body.id;

      const adoptionRequestData = {
        animalId,
        type: AdoptionType.ADOPTION,
        notes: 'I would love to adopt Fluffy',
      };

      const adoptionRequestResponse = await request(testSetup.getHttpServer())
        .post('/adoptions/request')
        .set('Authorization', `Bearer ${adopterToken}`)
        .send(adoptionRequestData)
        .expect(201);

      const adoptionId = adoptionRequestResponse.body.id;
      expect(adoptionRequestResponse.body.status).toBe(AdoptionStatus.PENDING);

      const adoptionRequestsResponse = await request(testSetup.getHttpServer())
        .get('/adoptions/received')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(adoptionRequestsResponse.body).toHaveLength(1);
      expect(adoptionRequestsResponse.body[0].id).toBe(adoptionId);
      expect(adoptionRequestsResponse.body[0].animalId).toBe(animalId);
      expect(adoptionRequestsResponse.body[0].adopterInfo.email).toBe(adopterData.email);

      const approveResponse = await request(testSetup.getHttpServer())
        .post(`/adoptions/${adoptionId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ notes: 'Approved. You can pick up Fluffy next week.' })
        .expect(200);

      expect(approveResponse.body.status).toBe(AdoptionStatus.APPROVED);

      const getAnimalResponse = await request(testSetup.getHttpServer())
        .get(`/animals/${animalId}`)
        .expect(200);

      expect(getAnimalResponse.body.adoptionStatus).toBe('ADOPTED');

      const getAdoptionResponse = await request(testSetup.getHttpServer())
        .get(`/adoptions/${adoptionId}`)
        .set('Authorization', `Bearer ${adopterToken}`)
        .expect(200);

      expect(getAdoptionResponse.body.status).toBe(AdoptionStatus.APPROVED);
      expect(getAdoptionResponse.body.notes).toContain('Approved');
    });

    it('should handle visit requests', async () => {
      const { user: owner, token: ownerToken } = await createUserAndGetToken({
        email: 'owner@example.com',
        password: 'Password123!',
        firstName: 'Owner',
        lastName: 'User',
        phone: '923456789',
        role: UserRole.ADOPTER,
        address: 'Owner Address',
        dni: '87654321'
      });

      const { user: adopter, token: adopterToken } = await createUserAndGetToken({
        email: 'adopter@example.com',
        password: 'Password123!',
        firstName: 'Adopter',
        lastName: 'User',
        phone: '987654321',
        role: UserRole.ADOPTER,
        address: 'Adopter Address',
        dni: '12345678'
      });

      const createAnimalResponse = await request(testSetup.getHttpServer())
        .post('/animals')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Whiskers',
          type: AnimalType.CAT,
          breed: 'Siamese',
          gender: AnimalGender.FEMALE,
          age: 3,
          description: 'A beautiful cat looking for a new home',
          weight: 4,
          color: 'White and Brown',
          isVaccinated: true,
          isNeutered: true,
          healthDetails: 'Healthy and playful',
          adoptionStatus: 'AVAILABLE',
        })
        .expect(201);

      const animalId = createAnimalResponse.body.id;

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const visitRequestData = {
        animalId,
        type: AdoptionType.VISIT,
        visitDate: tomorrow.toISOString(),
        notes: 'I would like to visit Whiskers tomorrow',
      };

      const visitRequestResponse = await request(testSetup.getHttpServer())
        .post('/adoptions/request')
        .set('Authorization', `Bearer ${adopterToken}`)
        .send(visitRequestData)
        .expect(201);

      const visitId = visitRequestResponse.body.id;
      expect(visitRequestResponse.body.status).toBe(AdoptionStatus.PENDING);
      expect(visitRequestResponse.body.visitDate).toBeDefined();

      const approveResponse = await request(testSetup.getHttpServer())
        .post(`/adoptions/${visitId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ notes: 'Approved. Looking forward to your visit.' })
        .expect(200);

      expect(approveResponse.body.status).toBe(AdoptionStatus.APPROVED);

      const getAnimalResponse = await request(testSetup.getHttpServer())
        .get(`/animals/${animalId}`)
        .expect(200);

      expect(getAnimalResponse.body.adoptionStatus).toBe('AVAILABLE');
    });
  });
});