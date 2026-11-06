import { describe, expect, it } from "vitest";
import { validateProject } from "../validate/validate";
import { parseTypeOrmSource } from "./typeorm-ast";

describe("parseTypeOrmSource", () => {
  it("parses TypeORM entity classes, column decorators, and relations", () => {
    const source = `
      export enum TaskPriority {
        LOW = 'LOW',
        MEDIUM = 'MEDIUM',
        HIGH = 'HIGH'
      }

      @Entity('projects')
      export class ProjectEntity {
        @PrimaryGeneratedColumn('uuid')
        id: string;

        @Column({ type: 'varchar', length: 120 })
        name: string;

        @Column({ type: 'text', nullable: true })
        description?: string;

        @CreateDateColumn()
        createdAt: Date;

        @UpdateDateColumn()
        updatedAt: Date;

        @OneToMany(() => TaskEntity, (task) => task.project)
        tasks: TaskEntity[];
      }

      @Entity('tasks')
      export class TaskEntity {
        @PrimaryGeneratedColumn()
        id: number;

        @Column()
        title: string;

        @Column({ type: 'enum', enum: TaskPriority })
        priority: TaskPriority;

        @Column({ type: 'boolean', default: false })
        completed: boolean;

        @ManyToOne(() => ProjectEntity, { nullable: false, cascade: true })
        project: ProjectEntity;

        @DeleteDateColumn()
        deletedAt?: Date;
      }
    `;

    const project = parseTypeOrmSource(source, { projectName: "Task Studio" });

    expect(project.name).toBe("Task Studio");
    expect(project.enums.length).toBe(1);
    expect(project.enums[0].name).toBe("TaskPriority");
    expect(project.enums[0].values).toEqual(["LOW", "MEDIUM", "HIGH"]);

    const projectEntity = project.entities.find((e) => e.name === "ProjectEntity");
    const taskEntity = project.entities.find((e) => e.name === "TaskEntity");

    expect(projectEntity).toBeDefined();
    expect(taskEntity).toBeDefined();

    expect(projectEntity?.options.timestamps).toBe(true);
    expect(taskEntity?.options.softDelete).toBe(true);

    const titleField = taskEntity?.fields.find((f) => f.name === "title");
    expect(titleField?.type).toBe("string");

    const priorityField = taskEntity?.fields.find((f) => f.name === "priority");
    expect(priorityField?.type).toBe("enum");
    expect(priorityField?.enumId).toBe(project.enums[0].id);

    const projectRel = taskEntity?.relations.find((r) => r.name === "project");
    expect(projectRel).toBeDefined();
    expect(projectRel?.targetEntityId).toBe(projectEntity?.id);
    expect(projectRel?.cascade).toBe(true);

    const issues = validateProject(project);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });
});
