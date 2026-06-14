import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import config from "../config";
import { pool } from "../db";

const auth = (...roles: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {

            const authHeader = req.headers.authorization;
            const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;

            if (!token) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized access",
                });
            }

            
            const decoded = jwt.verify(
                token as string,
                config.secret as string,
            ) as JwtPayload;

            
            const userData = await pool.query(
                `SELECT * FROM users WHERE id=$1`,
                [decoded.id], 
            );

            if (userData.rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: "User not found or token invalid",
                });
            }

            const user = userData.rows[0];

           
            if (roles.length && !roles.includes(user.role)) {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden: You do not have the required permissions",
                });
            }

            req.user = decoded;

            next();
        } catch (error) {
            
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Invalid or expired token",
            });
        }
    };
};

export default auth;