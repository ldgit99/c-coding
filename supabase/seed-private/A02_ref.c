#include <stdio.h>

int main(void) {
    int arr[] = { -8, 9, -20, 21, -26, -41, 45, -51, 78, 90 };
    int max, min;

    int *p;

    p = arr;
    max = *arr;
    min = *arr;

    printf("arr[] = { ");

    for (int i = 0; i < 10; i++) {
        printf("%d ", *(p + i));

        if (*(p + i) > max) {
            max = *(p + i);
        }

        if (*(p + i) < min) {
            min = *(p + i);
        }
    }

    printf("}\n\n");
    printf("최댓값: %d\n", max);
    printf("최솟값: %d", min);

    return 0;
}
