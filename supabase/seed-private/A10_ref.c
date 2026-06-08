#include <stdio.h>

struct Student {
    char name[50];
    int score;
};

void printStudents(struct Student *students, int size) {
    int i;

    printf("전체 학생 정보\n");

    for (i = 0; i < size; i++) {
        printf("이름: %s, 점수: %d\n",
               students[i].name,
               students[i].score);
    }
}

double getAverage(struct Student *students, int size) {
    int i;
    int sum = 0;

    for (i = 0; i < size; i++) {
        sum += students[i].score;
    }

    return (double)sum / size;
}

void printAboveAverage(struct Student *students, int size, double average) {
    int i;

    printf("\n평균 이상 학생\n");

    for (i = 0; i < size; i++) {
        if (students[i].score >= average) {
            printf("이름: %s, 점수: %d\n",
                   students[i].name,
                   students[i].score);
        }
    }
}

int main(void)
{
    struct Student students[3] = {
        {"Kim", 90},
        {"Lee", 80},
        {"Park", 70}
    };

    double average;

    printStudents(students, 3);

    average = getAverage(students, 3);
    printf("\n평균 점수: %.2f\n", average);

    printAboveAverage(students, 3, average);

    return 0;
}
