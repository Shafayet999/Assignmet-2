import config from "../../config";
import { pool } from "../../db";
import type { LogInCredentials, SignUpCredentials } from "./auth.interface";
import bcrypt from "bcryptjs";
import jwt, { type JwtPayload } from "jsonwebtoken";

const signUpUserIntoDB = async (payload: SignUpCredentials) => {
    const { name, email, password, role } = payload;

    const hashPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
        `
        INSERT INTO users (name, email, password, role) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, name, email, role, created_at, updated_at
        `,
        [name, email, hashPassword, role],
    );
    return result.rows[0];
};

const logInUserIntoDB = async (payload: LogInCredentials) => {
    const { email, password } = payload;

    const userData = await pool.query(`SELECT * FROM users WHERE email=$1`, [
        email,
    ]);

    if (userData.rows.length === 0) {
        throw new Error("invalid credentials");
    }

    const user = userData.rows[0];

    const matchPassword = await bcrypt.compare(password, user.password);

    if (!matchPassword) {
        throw new Error("invalid credentials");
    }

    const jwtpayload = {
        id: user.id,
        name: user.name,
        role: user.role,
        // is_active: user.is_active,
        // email: user.email,
    };

    const accessToken = jwt.sign(jwtpayload, config.secret as string, {
        expiresIn: "1d",
    });

    const refreshToken = jwt.sign(jwtpayload, config.refresh_secret as string, {
        expiresIn: "90d",
    });
    
    const { password: userPassword, ...userWithoutPassword } = user;

    return { token: accessToken, user: userWithoutPassword, refreshToken: refreshToken, };
};

const generateNewAccessToken = async (token: string) => {
    if (!token) {
        throw new Error("unauthorized");
    }

    const decoded = jwt.verify(
        token as string,
        config.refresh_secret as string,
    ) as JwtPayload;

    const userData = await pool.query(
        `
            SELECT * FROM users WHERE email=$1
        `,
        [decoded.email],
    );

    const user = userData.rows[0];

    if (userData.rows.length === 0) {
        throw new Error("user not found");
    }



    const jwtpayload = {
        id: user.id,
        name: user.name,
        role: user.role,
        is_active: user.is_active,
        email: user.email,
    };

    const accessToken = jwt.sign(jwtpayload, config.secret as string, {
        expiresIn: "1d",
    });
    return {accessToken}
};

export const authService = {
    signUpUserIntoDB,
    logInUserIntoDB,
    generateNewAccessToken,
};
