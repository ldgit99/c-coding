#include <stdio.h>
#include <string.h>

// 성적 정보를 나타내는 구조체
struct Score {
    int korean;
    int english;
    int math;
};

// 학생 정보를 나타내는 구조체 (Score 중첩)
struct Student {
    char name[50];
    struct Score exam;
};

int main(void)
{
    struct Student student;
    int total;
    double average;

    // 데이터 저장
    strcpy(student.name, "Kim Min Jun");
    student.exam.korean = 90;
    student.exam.english = 85;
    student.exam.math = 95;

    // 총점과 평균 계산
    total = student.exam.korean + student.exam.english + student.exam.math;
    average = total / 3.0;

    // 데이터 출력
    printf("Name: %s\n", student.name);
    printf("Korean: %d\n", student.exam.korean);
    printf("English: %d\n", student.exam.english);
    printf("Math: %d\n", student.exam.math);
    printf("Total: %d\n", total);
    printf("Average: %.2f\n", average);

    return 0;
}
