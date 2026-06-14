import { pool } from "../../db";
import type { CreateIssuePayload } from "./issue.interface";


const createIssueIntoDB = async (payload: CreateIssuePayload, reporter_id : number) => {
    const { title, description, type } = payload;

    const result = await pool.query(
        `
        INSERT INTO issues (title, description, type, reporter_id) 
        VALUES ($1, $2, $3, $4) 
        RETURNING id, title, description, type, status, reporter_id, created_at, updated_at
        `,
        [title, description, type, reporter_id]
    );

    return result.rows[0];
}

const getAllIssuesFromDB = async (sort?: string, type?: string, status?: string) => {
    
    let queryStr = `SELECT * FROM issues`;
    const queryValues: any[] = [];
    const whereConditions: string[] = [];

  
    if (type) {
        queryValues.push(type);
        whereConditions.push(`type = $${queryValues.length}`);
    }
    if (status) {
        queryValues.push(status);
        whereConditions.push(`status = $${queryValues.length}`); 
    }

    
    if (whereConditions.length > 0) {
        queryStr += ` WHERE ` + whereConditions.join(' AND ');
    }

    if (sort === 'oldest') {
        queryStr += ` ORDER BY created_at ASC`;
    } else {
        queryStr += ` ORDER BY created_at DESC`;
    }

    const issuesResult = await pool.query(queryStr, queryValues);
    const issues = issuesResult.rows;

    if (issues.length === 0) {
        return [];
    }

 
    const reporterIds = issues.map(issue => issue.reporter_id);

  
    const usersResult = await pool.query(
        `SELECT id, name, role FROM users WHERE id = ANY($1::int[])`,
        [reporterIds]
    );
    const users = usersResult.rows;

  
    const finalResult = issues.map(issue => {
       
        const reporterInfo = users.find(user => user.id === issue.reporter_id);

        return {
            id: issue.id,
            title: issue.title,
            description: issue.description,
            type: issue.type,
            status: issue.status,
            reporter: {
                id: reporterInfo?.id,
                name: reporterInfo?.name,
                role: reporterInfo?.role
            },
            created_at: issue.created_at,
            updated_at: issue.updated_at
        };
    });

    return finalResult;
};

const getSingleIssueFromDB = async (id: number) => {
   
    const issueResult = await pool.query(`SELECT * FROM issues WHERE id = $1`, [id]);
    
   
    if (issueResult.rows.length === 0) {
        throw new Error("Issue not found");
    }
    
    const issue = issueResult.rows[0];

   
    const userResult = await pool.query(
        `SELECT id, name, role FROM users WHERE id = $1`,
        [issue.reporter_id]
    );
    const reporterInfo = userResult.rows[0];

    return {
        id: issue.id,
        title: issue.title,
        description: issue.description,
        type: issue.type,
        status: issue.status,
        reporter: {
            id: reporterInfo?.id,
            name: reporterInfo?.name,
            role: reporterInfo?.role
        },
        created_at: issue.created_at,
        updated_at: issue.updated_at
    };
};

const deleteIssueFromDB = async (id: number) => {
    
    const result = await pool.query(
        `DELETE FROM issues WHERE id = $1 RETURNING id`, 
        [id]
    );


    if (result.rowCount === 0) {
        throw new Error("Issue not found");
    }

    return true; 
};


const updateIssueInDB = async (id: number, payload: any, user: any) => {
  
    const issueResult = await pool.query(`SELECT * FROM issues WHERE id = $1`, [id]);
    
    if (issueResult.rows.length === 0) {
        throw new Error("Issue not found");
    }

    const issue = issueResult.rows[0];

   
    if (user.role === 'contributor') {
       
        if (issue.reporter_id !== user.id) {
            throw new Error("Forbidden: You can only update your own issues");
        }
      
        if (issue.status !== 'open') {
            throw new Error("Forbidden: You can only update issues that are currently open");
        }
    }

    const fields: string[] = [];
    const values: any[] = [];
    let index = 1;

    if (payload.title) {
        fields.push(`title = $${index++}`);
        values.push(payload.title);
    }
    if (payload.description) {
        fields.push(`description = $${index++}`);
        values.push(payload.description);
    }
    if (payload.type) {
        fields.push(`type = $${index++}`);
        values.push(payload.type);
    }
    if (payload.status) {
       
        if (user.role === 'contributor') {
            throw new Error("Forbidden: Contributors cannot change issue status");
        }
        fields.push(`status = $${index++}`);
        values.push(payload.status);
    }

  
    if (fields.length === 0) {
        throw new Error("No fields provided for update");
    }

   
    fields.push(`updated_at = CURRENT_TIMESTAMP`);

  
    values.push(id); 

    const queryStr = `UPDATE issues SET ${fields.join(", ")} WHERE id = $${index} RETURNING *`;


    const updatedResult = await pool.query(queryStr, values);

    return updatedResult.rows[0];
};

export const issueService = {
    createIssueIntoDB, getAllIssuesFromDB, getSingleIssueFromDB, deleteIssueFromDB, updateIssueInDB
}; 