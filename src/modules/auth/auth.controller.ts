import type { Request, Response } from "express";
import { authService } from "./auth.service";


const signUpUser = async (req: Request, res: Response) => {
    try {
        const result = await authService.signUpUserIntoDB(req.body);

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: result,
        });
    } catch (error: any) {
        res.status(400).json({
            success: false,
            message: "Failed to create user",
            error: error.message,
        });
    }
};


const logInUser = async (req: Request, res: Response) =>{
    try {
        const result = await authService.logInUserIntoDB(req.body);

        const { refreshToken } = result;

        res.cookie("refreshToken", refreshToken, {
            secure: false, //in production => true
            httpOnly: true,
            sameSite: "lax",
        });

        res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                token: result.token,
                user : result.user
            }

        });

    } catch (error: any) {
        res.status(400).json({
            success: false,
            message: "Failed to login user",
            error: error.message,
        });
    }
};

// কন্ট্রোলারের নাম দিলাম getNewAccessToken
const getNewAccessToken = async (req: Request, res: Response) => {
    try {
        const oldRefreshToken = req.cookies.refreshToken;

        // সার্ভিসের নাম দিলাম generateNewAccessToken (কারণ সে এটাই করছে!)
        const newAccessToken = await authService.generateNewAccessToken(oldRefreshToken);

        return res.status(200).json({ 
            success: true,
            message: "Access Token generated successfully",
            data: {
                accessToken: newAccessToken, // নামগুলো এখন একদম ক্লিয়ার!
            },
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message,
            error: error,
        });
    }
};

export const authController = {
    signUpUser, logInUser, getNewAccessToken
};
