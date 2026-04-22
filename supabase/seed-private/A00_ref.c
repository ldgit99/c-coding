#include <stdio.h>

double average(int x[]);

int main(void) {
    double avg;
    int base[5] = {3, 7, 2, 4, 5};

    avg = average(base);
    printf("base average = %.3f\n", avg);

    return 0;
}

double average(int x[]) {
    int sum = 0;
    for (int i = 0; i < 5; i++) sum += x[i];
    return sum / 5.0;
}
