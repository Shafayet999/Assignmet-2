import { Router } from "express";
import auth from "../../middleware/auth";
import { issueController } from "./issue.controller";

const router = Router();

router.post("/", auth("contributor", "maintainer"), issueController.createIssue);

router.get("/", issueController.getAllIssues);

router.get("/:id", issueController.getSingleIssue);

router.delete("/:id", auth("maintainer"), issueController.deleteIssue);
router.patch("/:id", auth("contributor", "maintainer"), issueController.updateIssue);

export const issueRoutes = router; 