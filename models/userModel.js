
const { db } = require("../config/firebase");

const COLLECTION_NAME = "users";

const normalizeEmail = (email) => email.trim().toLowerCase();

const UserModel = {
  async createUser(userData) {
    const normalizedEmail = normalizeEmail(userData.email);

    const docRef = db.collection(COLLECTION_NAME).doc(normalizedEmail);

    await docRef.create({
      ...userData,
      email: normalizedEmail,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const newUser = await docRef.get();

    return {
      id: docRef.id,
      ...newUser.data(),
    };
  },

  async findUserByEmail(email) {
    const normalizedEmail = normalizeEmail(email);

    const doc = await db
      .collection(COLLECTION_NAME)
      .doc(normalizedEmail)
      .get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
    };
  },

  async findUserById(id) {
    const doc = await db.collection(COLLECTION_NAME).doc(id).get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
    };
  },
};

module.exports = UserModel;
