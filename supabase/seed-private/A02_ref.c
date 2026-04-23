#include <stdio.h>

void swap(int *a, int *b);

int main(void) {
    int a, b;
    scanf("%d %d", &a, &b);
    printf("before swap() : a=%d, b=%d\n", a, b);
    swap(&a, &b);
    printf("after swap() : a=%d, b=%d\n", a, b);
    return 0;
}

void swap(int *a, int *b) {
    int tmp = *a;
    *a = *b;
    *b = tmp;
}
