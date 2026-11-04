const { db } = require("../config/firebase");

const COLLECTION_NAME = "users";

const UserModel = {
  async createUser(userData) {
    const docRef = await db.collection(COLLECTION_NAME).add({
      ...userData,
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
    const normalizedEmail = email.trim().toLowerCase();
    const snapshot = await db
      .collection(COLLECTION_NAME)
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];

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