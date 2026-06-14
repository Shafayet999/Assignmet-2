import type { Request, Response } from "express";
import { issueService } from "./issue.service";


const createIssue = async (req: Request, res: Response) => {
    try {
        
        const reporter_id = (req as any).user.id; 

        
        const result = await issueService.createIssueIntoDB(req.body, reporter_id);

       
        res.status(201).json({
            success: true,
            message: "Issue created successfully",
            data: result
        });
    } catch (error: any) {
        res.status(400).json({
            success: false, 
            message: "Failed to create issue",
            error: error.message
        });
    }
};

const getAllIssues = async (req: Request, res: Response) => {
    try {
        const { sort, type, status } = req.query;
        const result = await issueService.getAllIssuesFromDB(
            sort as string, 
            type as string, 
            status as string
        );
        res.status(200).json({
            success: true,
            message: "Issues retrieved successfully",
            data: result
        });
    } catch (error : any) {
        res.status(400).json({
            success: false, 
            message: "Failed to retrieve issues",
            error: error.message
        });
    }
}

const getSingleIssue = async (req: Request, res: Response) => {
    try {
       
        const { id } = req.params; 
        
        
        const result = await issueService.getSingleIssueFromDB(Number(id));
        
        return res.status(200).json({
            success: true,
            message: "Issue retrieved successfully",
            data: result
        });
    } catch (error: any) {
        
        return res.status(404).json({
            success: false, 
            message: "Failed to retrieve issue",
            error: error.message
        });
    }
};

const deleteIssue = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        await issueService.deleteIssueFromDB(Number(id));
        
       
        return res.status(200).json({
            success: true,
            message: "Issue deleted successfully"
        });
    } catch (error: any) {
        return res.status(404).json({
            success: false, 
            message: "Failed to delete issue",
            error: error.message
        });
    }
};

const updateIssue = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const issueData = req.body;
        
       
        const user = (req as any).user; 

        const result = await issueService.updateIssueInDB(Number(id), issueData, user);
        
        return res.status(200).json({
            success: true,
            message: "Issue updated successfully",
            data: result
        });
    } catch (error: any) {
       
        const statusCode = error.message.includes("Forbidden") ? 403 : 400;
        
        return res.status(statusCode).json({
            success: false, 
            message: "Failed to update issue",
            error: error.message
        });
    }
};

export const issueController = {
    createIssue, getAllIssues, getSingleIssue, deleteIssue, updateIssue
};