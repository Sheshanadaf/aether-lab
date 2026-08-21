export const LINKS = {
  github: "https://github.com/Sheshanadaf",
  linkedin:
    "https://www.linkedin.com/in/sheshan-hebron-04a557213?utm_source=share_via&utm_content=profile&utm_medium=member_ios",
  youtube: "https://www.youtube.com/@CloudNest1",
  medium: "https://medium.com/@sheshanhebron61",
  email: "mailto:sheshanhebron61@gmail.com",
  resume: "/Sheshan-Hebron-CV.pdf",
  aetherRepo: "https://github.com/Sheshanadaf/aether-lab",
  saa: "https://www.credly.com/badges/524eb158-406b-4d44-b663-29e71ff024a8/public_url",
  ccp: "https://www.credly.com/badges/42e6b4ed-a42b-4ae2-ad0c-5f785bbe29ed/linked_in_profile",
};

export type ShareItem = {
  href: string;
  title: string;
  thumb: string;
};

function yt(id: string, title: string): ShareItem {
  return {
    href: `https://youtu.be/${id}`,
    title,
    thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}

export const SHARE_YOUTUBE: ShareItem[] = [
  yt("1kxbcddcz30", "AWS Full Course Sinhala | Complete Beginner Roadmap"),
  yt("zY80Wq-aJwo", "Serverless and small AWS Serverless Demo"),
  yt("6er4gzglUt4", "Hosted a machine learning application completely on AWS"),
  yt("qfZjqsqn-BU", "AWS Global Infrastructure Explained Sinhala | Regions, AZs & Edge Locations | Lesson 01"),
  yt("G-KzUGkXZGE", "AWS EC2 Sinhala Tutorial | Placement Groups, ENI & EC2 Hibernate Explained | Lesson 3 - Part 04"),
  yt("Rx4RZ0FWP2Y", "AWS EC2 Sinhala Tutorial | Elastic IP & EC2 Purchasing Options Explained | Lesson 3 - Part 03"),
];

export type SkillLogo = {
  name: string;
  src: string;
};

export type SkillOrbitGroup = {
  id: "cloud" | "devops" | "programming" | "data";
  title: string;
  logos: SkillLogo[];
};

const icon = (file: string) => `/skills/${file}`;

export const SKILL_ORBIT: SkillOrbitGroup[] = [
  {
    id: "cloud",
    title: "Cloud",
    logos: [
      { name: "AWS", src: icon("aws-badge.svg") },
      { name: "Lambda", src: icon("lambda.svg") },
      { name: "S3", src: icon("s3.svg") },
      { name: "CloudFront", src: icon("cloudfront.svg") },
      { name: "API Gateway", src: icon("apigateway.svg") },
      { name: "EC2", src: icon("ec2.svg") },
      { name: "RDS", src: icon("rds.svg") },
    ],
  },
  {
    id: "devops",
    title: "DevOps",
    logos: [
      { name: "Terraform", src: icon("terraform.svg") },
      { name: "GitHub Actions", src: icon("githubactions.svg") },
      { name: "Docker", src: icon("docker.svg") },
      { name: "Kubernetes", src: icon("kubernetes.svg") },
      { name: "Jenkins", src: icon("jenkins.svg") },
      { name: "GitHub", src: icon("github.svg") },
    ],
  },
  {
    id: "programming",
    title: "Programming",
    logos: [
      { name: "Python", src: icon("python.svg") },
      { name: "TypeScript", src: icon("typescript.svg") },
      { name: "JavaScript", src: icon("javascript.svg") },
      { name: "Node.js", src: icon("nodejs.svg") },
      { name: "React", src: icon("react.svg") },
      { name: "Flutter", src: icon("flutter.svg") },
    ],
  },
  {
    id: "data",
    title: "Data",
    logos: [
      { name: "DynamoDB", src: icon("dynamodb.svg") },
      { name: "MongoDB", src: icon("mongodb.svg") },
      { name: "MySQL", src: icon("mysql.svg") },
      { name: "DocumentDB", src: icon("documentdb.svg") },
    ],
  },
];

export type ProjectLink = {
  kind: "github" | "youtube" | "labs" | "web";
  label: string;
  href: string;
};

export type Project = {
  kicker: string;
  name: string;
  title: string;
  blurb: string;
  image: string;
  alt: string;
  links: ProjectLink[];
};

export const PROJECTS: Project[] = [
  {
    kicker: "Featured Project",
    name: "Aether Lab",
    title: "Aether Lab – Live Serverless AWS Lab",
    blurb:
      "A live CloudFront + Lambda lab you can walk hop by hop: private S3, HTTP API, DynamoDB, SQS/DLQ, Cognito JWT, Terraform, and GitHub Actions OIDC — on a small monthly budget.",
    image: "/aether-lab-architecture.png",
    alt: "Aether Lab AWS architecture diagram",
    links: [
      { kind: "labs", label: "Live labs", href: "/labs" },
      { kind: "github", label: "GitHub repository", href: "https://github.com/Sheshanadaf/aether-lab" },
    ],
  },
  {
    kicker: "Featured Project",
    name: "Job Recommendation System on AWS",
    title: "Job Recommendation System on AWS",
    blurb:
      "React and Node job-matching hosted on AWS: S3 frontend, ALB and Auto Scaling EC2, SageMaker, Lambda, and DocumentDB — with an architecture diagram and demo walkthrough.",
    image: "/job-rec-architecture.png",
    alt: "Job Recommendation System on AWS architecture",
    links: [
      {
        kind: "github",
        label: "GitHub repository",
        href: "https://github.com/Sheshanadaf/Job-Recommendation-System-on-AWS",
      },
      { kind: "youtube", label: "Demo video", href: "https://youtu.be/6er4gzglUt4" },
    ],
  },
  {
    kicker: "Featured Project",
    name: "Library Management System on AWS",
    title: "Library Management System on AWS",
    blurb:
      "A multi-AZ library web app shipped with CloudFormation: ALB, Auto Scaling EC2, DynamoDB, and a CodePipeline / CodeBuild / CodeDeploy path instead of a laptop-only demo.",
    image: "/library-architecture.png",
    alt: "Library Management System on AWS architecture",
    links: [
      {
        kind: "github",
        label: "GitHub repository",
        href: "https://github.com/Sheshanadaf/library-managment-system-on-AWS",
      },
    ],
  },
];
