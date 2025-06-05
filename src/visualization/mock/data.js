// 教师能力评估数据
const teacherSkillsData = {
    pie: [
        { label: "教学能力", value: 35 },
        { label: "专业知识", value: 25 },
        { label: "沟通技巧", value: 20 },
        { label: "课程设计", value: 15 },
        { label: "其他", value: 5 }
    ],
    bar: [
        { label: "教学评分", value: 85 },
        { label: "科研成果", value: 72 },
        { label: "学生反馈", value: 90 },
        { label: "课程创新", value: 68 },
        { label: "团队协作", value: 78 }
    ]
};

// 论文发表统计数据
const publicationData = {
    bar: [
        { label: "2019", value: 3 },
        { label: "2020", value: 5 },
        { label: "2021", value: 4 },
        { label: "2022", value: 7 },
        { label: "2023", value: 16 }
    ]
};

// 教学成果数据
const teachingAchievementData = {
    pie: [
        { label: "优秀", value: 45 },
        { label: "良好", value: 30 },
        { label: "合格", value: 20 },
        { label: "待改进", value: 5 }
    ]
};

module.exports = {
    teacherSkillsData,
    publicationData,
    teachingAchievementData
}; 